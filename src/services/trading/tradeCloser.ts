
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradeValidation } from './tradeValidation';
import { AccountBalanceChecker } from './accountBalanceChecker';

export class TradeCloser {
  private userId: string;
  private bybitService: BybitService;
  private config: TradingConfigData;
  private balanceChecker: AccountBalanceChecker;

  constructor(userId: string, bybitService: BybitService, config: TradingConfigData) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.config = config;
    this.balanceChecker = new AccountBalanceChecker(bybitService);
  }

  async closePosition(trade: any, currentPrice: number, dollarProfitLoss: number): Promise<void> {
    try {
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());
      const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      
      console.log(`💰 Attempting to close position for ${trade.symbol}:`);
      console.log(`  Entry: $${entryPrice}`);
      console.log(`  Exit: $${currentPrice}`);
      console.log(`  Quantity: ${quantity}`);
      console.log(`  Dollar P&L: $${dollarProfitLoss.toFixed(2)}`);
      console.log(`  Percent P&L: ${profitPercent.toFixed(2)}%`);

      // Check if trade is already closed
      const { data: currentTrade } = await supabase
        .from('trades')
        .select('status')
        .eq('id', trade.id)
        .single();

      if (currentTrade?.status === 'closed') {
        console.log(`Trade ${trade.id} is already closed, skipping`);
        return;
      }

      // Format quantity properly for close order - use stricter formatting
      const formattedQuantity = TradeValidation.getFormattedQuantity(trade.symbol, quantity);
      
      // Validate minimum order value before placing sell order
      if (!TradeValidation.isValidOrderValue(trade.symbol, parseFloat(formattedQuantity), currentPrice)) {
        console.log(`❌ Cannot close ${trade.symbol}: order value below minimum`);
        await this.logActivity('order_rejected', `Cannot close ${trade.symbol}: order value below minimum`, {
          tradeId: trade.id,
          quantity: formattedQuantity,
          currentPrice,
          orderValue: parseFloat(formattedQuantity) * currentPrice,
          reason: 'order_value_too_low'
        });
        return;
      }

      let closeOrderId = null;
      let closeSuccessful = false;

      try {
        console.log(`🔄 Placing sell order on Bybit for ${trade.symbol} with quantity: ${formattedQuantity}`);
        
        // Place sell order on Bybit
        const sellOrder = await this.bybitService.placeOrder({
          category: 'spot',
          symbol: trade.symbol,
          side: 'Sell',
          orderType: 'Market',
          qty: formattedQuantity,
        });

        console.log('Sell order response:', sellOrder);

        if (sellOrder.retCode === 0 && sellOrder.result?.orderId) {
          closeOrderId = sellOrder.result.orderId;
          closeSuccessful = true;
          
          console.log(`✅ Sell order placed successfully: ${closeOrderId}`);
        } else {
          console.error(`Failed to place sell order for ${trade.symbol}:`, sellOrder);
          await this.logActivity('execution_error', `Failed to place sell order for ${trade.symbol}`, { 
            sellOrder,
            reason: `Bybit error: ${sellOrder.retMsg}`,
            retCode: sellOrder.retCode,
            tradeId: trade.id,
            formattedQuantity
          });
          return;
        }
      } catch (orderError) {
        console.error(`Error placing close order for ${trade.symbol}:`, orderError);
        await this.logActivity('execution_error', `Error placing close order for ${trade.symbol}`, { 
          error: orderError instanceof Error ? orderError.message : 'Unknown error',
          tradeId: trade.id,
          symbol: trade.symbol,
          formattedQuantity
        });
        return;
      }

      // Only update database if Bybit order was successful
      if (closeSuccessful) {
        const { error } = await supabase
          .from('trades')
          .update({
            status: 'closed',
            profit_loss: dollarProfitLoss,
            updated_at: new Date().toISOString()
          })
          .eq('id', trade.id)
          .eq('status', 'filled'); // Only update if still filled

        if (error) {
          console.error(`Database error closing position:`, error);
          throw error;
        }

        console.log(`✅ Position closed successfully for ${trade.symbol}`);
        
        await this.logActivity('position_closed', `Position closed for ${trade.symbol} with ${profitPercent.toFixed(2)}% profit`, {
          symbol: trade.symbol,
          entryPrice,
          exitPrice: currentPrice,
          quantity: formattedQuantity,
          dollarProfitLoss,
          profitPercent,
          takeProfitTarget: this.config.take_profit_percent,
          tradeId: trade.id,
          sellOrderId: closeOrderId
        });
      }

    } catch (error) {
      console.error(`Error closing position for ${trade.symbol}:`, error);
      await this.logActivity('execution_error', `Failed to close position for ${trade.symbol}`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        tradeId: trade.id,
        symbol: trade.symbol 
      });
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      // Valid log types based on database constraints
      const validLogTypes = [
        'signal_processed',
        'trade_executed',
        'trade_filled',
        'position_closed',
        'system_error',
        'order_placed',
        'order_failed',
        'calculation_error',
        'execution_error',
        'signal_rejected',
        'order_rejected'
      ];

      // Map invalid types to valid ones
      const typeMapping: Record<string, string> = {
        'manual_close': 'position_closed',
        'close_rejected': 'order_rejected',
        'close_error': 'execution_error',
        'trade_closed': 'position_closed'
      };

      const validType = typeMapping[type] || (validLogTypes.includes(type) ? type : 'system_error');

      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: validType,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
