
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { OrderFillChecker } from './orderFillChecker';

export class PositionMonitor {
  private userId: string;
  private bybitService: BybitService;
  private config: TradingConfigData;
  private orderFillChecker: OrderFillChecker;

  constructor(userId: string, bybitService: BybitService, config: TradingConfigData) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.config = config;
    this.orderFillChecker = new OrderFillChecker(userId, bybitService);
    
    console.log('PositionMonitor initialized with config:', {
      takeProfitPercent: this.config.take_profit_percent,
      entryOffsetPercent: this.config.entry_offset_percent,
      maxPositionsPerPair: this.config.max_positions_per_pair
    });
  }

  private formatQuantityForSymbol(symbol: string, quantity: number): string {
    // Enhanced precision rules based on Bybit demo requirements
    const precisionRules: Record<string, number> = {
      'BTCUSDT': 5,
      'ETHUSDT': 3,
      'BNBUSDT': 2,
      'SOLUSDT': 2,
      'ADAUSDT': 0,
      'XRPUSDT': 0,
      'LTCUSDT': 3,
      'DOGEUSDT': 0,
      'MATICUSDT': 0,
      'FETUSDT': 0,
      'POLUSDT': 0,
      'XLMUSDT': 0,
    };

    const decimals = precisionRules[symbol] || 2;
    let formattedQty = quantity.toFixed(decimals);
    
    if (decimals > 0) {
      formattedQty = parseFloat(formattedQty).toString();
    }
    
    console.log(`Formatting quantity for ${symbol}: ${quantity} -> ${formattedQty} (${decimals} decimals)`);
    return formattedQty;
  }

  private validateMinOrderValue(symbol: string, quantity: number, price: number): boolean {
    const orderValue = quantity * price;
    
    // Enhanced minimum order values for different symbols
    const minOrderValues: Record<string, number> = {
      'BTCUSDT': 20,
      'ETHUSDT': 20,
      'BNBUSDT': 20,
      'SOLUSDT': 20,
      'LTCUSDT': 20,
      'ADAUSDT': 10,
      'XRPUSDT': 10,
      'DOGEUSDT': 10,
      'MATICUSDT': 10,
      'FETUSDT': 10,
      'POLUSDT': 10,
      'XLMUSDT': 10,
    };

    const minValue = minOrderValues[symbol] || 20;
    
    console.log(`Order value validation for ${symbol}: ${orderValue.toFixed(2)} USD (min: ${minValue})`);
    
    if (orderValue < minValue) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} below minimum ${minValue}`);
      return false;
    }
    
    return true;
  }

  async monitorPositions(): Promise<void> {
    console.log('🔍 Starting position monitoring...');
    console.log(`Using take profit percentage from config: ${this.config.take_profit_percent}%`);
    
    try {
      // Check and fill any pending orders first
      console.log('🔄 Checking pending orders for fill conditions...');
      await this.orderFillChecker.checkAndFillPendingOrders();

      // Then monitor filled positions for take profit
      const { data: filledTrades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'filled');

      if (!filledTrades || filledTrades.length === 0) {
        console.log('No filled trades to monitor for take profit');
        return;
      }

      console.log(`Monitoring ${filledTrades.length} filled trades for take profit using config: ${this.config.take_profit_percent}%...`);

      for (const trade of filledTrades) {
        await this.checkTradeForClosure(trade);
      }
    } catch (error) {
      console.error('Error in position monitoring:', error);
      await this.logActivity('system_error', 'Position monitoring failed', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async checkTradeForClosure(trade: any): Promise<void> {
    try {
      console.log(`\n📊 Checking trade ${trade.id} for ${trade.symbol}:`);
      console.log(`  Entry Price: $${trade.price}`);
      console.log(`  Side: ${trade.side}`);
      console.log(`  Status: ${trade.status}`);
      console.log(`  Quantity: ${trade.quantity}`);
      console.log(`  Take Profit Target: ${this.config.take_profit_percent}%`);

      // Get fresh market price from Bybit testnet
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      
      console.log(`  Current Price: $${currentPrice}`);

      // Calculate profit/loss percentage and dollar amount
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());

      let profitPercent = 0;
      let dollarProfitLoss = 0;

      if (trade.side === 'buy') {
        profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
        dollarProfitLoss = (currentPrice - entryPrice) * quantity;
      } else {
        profitPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
        dollarProfitLoss = (entryPrice - currentPrice) * quantity;
      }

      console.log(`  Profit/Loss: ${profitPercent.toFixed(2)}% ($${dollarProfitLoss.toFixed(2)})`);
      console.log(`  Take Profit Target from config: ${this.config.take_profit_percent}%`);

      // Update the trade with current P&L
      await this.updateTradeWithCurrentPL(trade.id, dollarProfitLoss);

      // Check if profit target is reached
      if (profitPercent >= this.config.take_profit_percent) {
        console.log(`🎯 PROFIT TARGET REACHED! Closing position for ${trade.symbol} (${profitPercent.toFixed(2)}% >= ${this.config.take_profit_percent}%)`);
        await this.closePosition(trade, currentPrice, dollarProfitLoss);
      } else {
        console.log(`  📈 Position still under target (${profitPercent.toFixed(2)}% < ${this.config.take_profit_percent}%)`);
      }
    } catch (error) {
      console.error(`Error checking trade ${trade.id}:`, error);
      await this.logActivity('system_error', `Failed to check trade ${trade.id}`, { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        tradeId: trade.id,
        symbol: trade.symbol 
      });
    }
  }

  private async updateTradeWithCurrentPL(tradeId: string, dollarProfitLoss: number): Promise<void> {
    try {
      await supabase
        .from('trades')
        .update({
          profit_loss: dollarProfitLoss,
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId);
    } catch (error) {
      console.error('Error updating trade P&L:', error);
    }
  }

  private async closePosition(trade: any, currentPrice: number, dollarProfitLoss: number): Promise<void> {
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

      // Format quantity properly for close order
      const formattedQuantity = this.formatQuantityForSymbol(trade.symbol, quantity);
      
      // Validate minimum order value before placing sell order
      if (!this.validateMinOrderValue(trade.symbol, quantity, currentPrice)) {
        console.log(`❌ Cannot close ${trade.symbol}: order value below minimum`);
        await this.logActivity('order_rejected', `Cannot close ${trade.symbol}: order value below minimum`, {
          tradeId: trade.id,
          quantity: formattedQuantity,
          currentPrice,
          orderValue: quantity * currentPrice,
          reason: 'order_value_too_low'
        });
        return;
      }

      try {
        // Place sell order on Bybit testnet
        const sellOrder = await this.bybitService.placeOrder({
          category: 'spot',
          symbol: trade.symbol,
          side: 'Sell',
          orderType: 'Market',
          qty: formattedQuantity,
        });

        console.log('Sell order response:', sellOrder);

        if (sellOrder.retCode === 0) {
          // Update trade status to closed
          const { error } = await supabase
            .from('trades')
            .update({
              status: 'closed',
              profit_loss: dollarProfitLoss,
              updated_at: new Date().toISOString()
            })
            .eq('id', trade.id)
            .eq('status', 'filled');

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
            sellOrderId: sellOrder.result?.orderId
          });
        } else {
          console.error(`Failed to close position for ${trade.symbol}:`, sellOrder);
          await this.logActivity('execution_error', `Failed to close position for ${trade.symbol}`, { 
            sellOrder,
            reason: `Bybit error: ${sellOrder.retMsg}`,
            retCode: sellOrder.retCode,
            tradeId: trade.id,
            formattedQuantity
          });
        }
      } catch (orderError) {
        console.error(`Error placing close order for ${trade.symbol}:`, orderError);
        await this.logActivity('execution_error', `Error placing close order for ${trade.symbol}`, { 
          error: orderError instanceof Error ? orderError.message : 'Unknown error',
          tradeId: trade.id,
          symbol: trade.symbol,
          formattedQuantity
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
