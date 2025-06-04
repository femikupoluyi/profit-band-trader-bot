
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
        throw new Error('Trade not found');
      }

      if (trade.status !== 'filled') {
        throw new Error('Cannot close trade that is not filled');
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
          await supabase
            .from('trades')
            .update({
              status: 'closed',
              profit_loss: profit,
              updated_at: new Date().toISOString()
            })
            .eq('id', tradeId);

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
          throw new Error(`Market order failed: ${sellResult?.retMsg || 'Unknown error'}`);
        }

      } catch (sellError) {
        console.error(`❌ Market sell order failed:`, sellError);
        throw sellError;
      }

    } catch (error) {
      console.error(`❌ Error in manual close:`, error);
      await this.logActivity('system_error', `Manual close failed for trade ${tradeId}`, {
        error: error.message,
        tradeId
      });
      throw error;
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: type,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
