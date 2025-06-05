
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';

export class ManualCloseService {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async closePosition(tradeId: string): Promise<void> {
    try {
      console.log(`🔄 Manual close requested for trade ${tradeId}`);

      // Get the trade details
      const { data: trade, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('user_id', this.userId)
        .single();

      if (error || !trade) {
        console.error('Trade not found:', error);
        await this.logActivity('system_error', `Trade not found for manual close: ${tradeId}`, { 
          tradeId, 
          error: error?.message || 'Trade not found' 
        });
        throw new Error('Trade not found');
      }

      if (trade.status !== 'filled') {
        const errorMsg = `Cannot close trade that is not filled. Status: ${trade.status}`;
        console.error(errorMsg);
        await this.logActivity('order_rejected', errorMsg, { 
          tradeId, 
          currentStatus: trade.status 
        });
        throw new Error(errorMsg);
      }

      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      
      console.log(`  Current Price: $${currentPrice.toFixed(4)}`);
      console.log(`  Using MARKET order for immediate execution`);

      try {
        // Place MARKET sell order for immediate execution (as specified in requirements)
        const sellOrderParams = {
          category: 'spot' as const,
          symbol: trade.symbol,
          side: 'Sell' as const,
          orderType: 'Market' as const,
          qty: trade.quantity.toString(),
        };

        console.log('📝 Placing MARKET sell order:', sellOrderParams);
        const sellResult = await this.bybitService.placeOrder(sellOrderParams);

        if (sellResult && sellResult.retCode === 0) {
          // Calculate P&L
          const entryPrice = parseFloat(trade.price.toString());
          const quantity = parseFloat(trade.quantity.toString());
          const profit = (currentPrice - entryPrice) * quantity;

          // Update trade as closed
          const { error: updateError } = await supabase
            .from('trades')
            .update({
              status: 'closed',
              profit_loss: profit,
              updated_at: new Date().toISOString()
            })
            .eq('id', tradeId);

          if (updateError) {
            console.error('Database update error:', updateError);
            await this.logActivity('system_error', `Database update failed for manual close: ${trade.symbol}`, {
              tradeId,
              error: updateError.message
            });
            throw updateError;
          }

          console.log(`✅ Manual close completed: ${trade.symbol} P&L: $${profit.toFixed(2)}`);

          await this.logActivity('position_closed', `Manual close for ${trade.symbol}`, {
            tradeId,
            symbol: trade.symbol,
            entryPrice,
            exitPrice: currentPrice,
            profit,
            reason: 'manual_close_market_order'
          });

        } else {
          const errorMsg = `Market order failed: ${sellResult?.retMsg || 'Unknown error'}`;
          console.error(errorMsg);
          await this.logActivity('order_failed', errorMsg, {
            tradeId,
            symbol: trade.symbol,
            sellResult: sellResult
          });
          throw new Error(errorMsg);
        }

      } catch (sellError) {
        console.error(`❌ Market sell order failed:`, sellError);
        await this.logActivity('execution_error', `Market sell order failed for ${trade.symbol}`, {
          tradeId,
          error: sellError instanceof Error ? sellError.message : 'Unknown sell error'
        });
        throw sellError;
      }

    } catch (error) {
      console.error(`❌ Error in manual close:`, error);
      await this.logActivity('system_error', `Manual close failed for trade ${tradeId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tradeId
      });
      throw error;
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

      // Map any custom types to valid ones
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
