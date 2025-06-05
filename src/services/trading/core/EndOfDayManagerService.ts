
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class EndOfDayManagerService {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async manageEndOfDay(config: TradingConfigData): Promise<void> {
    try {
      if (!config.auto_close_at_end_of_day) {
        console.log('⏸️ End-of-day auto-close is disabled');
        return;
      }

      console.log('🌅 Checking end-of-day management...');

      // Check if we're near end of day (for now, just check if it's past 22:00 UTC)
      const currentHour = new Date().getUTCHours();
      const isEndOfDay = currentHour >= 22; // 10 PM UTC

      if (!isEndOfDay) {
        console.log(`⏰ Not end of day yet (current hour: ${currentHour} UTC)`);
        return;
      }

      console.log('🌅 End of day detected, checking positions to close...');

      // Get all active positions
      const { data: activeTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .in('status', ['filled', 'partial_filled']);

      if (error) {
        console.error('❌ Error fetching active trades:', error);
        return;
      }

      if (!activeTrades || activeTrades.length === 0) {
        console.log('📭 No active positions to close');
        return;
      }

      console.log(`📊 Found ${activeTrades.length} active positions to evaluate for EOD closure`);

      for (const trade of activeTrades) {
        await this.evaluateTradeForEODClosure(trade, config);
      }

      console.log('✅ End-of-day management completed');
    } catch (error) {
      console.error('❌ Error in end-of-day management:', error);
      throw error;
    }
  }

  private async evaluateTradeForEODClosure(trade: any, config: TradingConfigData): Promise<void> {
    try {
      console.log(`🔍 Evaluating ${trade.symbol} for EOD closure...`);

      // Get current market price
      const marketPrice = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketPrice.price;
      const entryPrice = parseFloat(trade.price.toString());

      // Calculate current P&L percentage
      const plPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;
      
      console.log(`  Entry: $${entryPrice.toFixed(4)}, Current: $${currentPrice.toFixed(4)}, P&L: ${plPercentage.toFixed(2)}%`);

      // Close if we're at a loss or small profit (based on EOD premium setting)
      const shouldClose = plPercentage < config.eod_close_premium_percent;
      
      if (shouldClose) {
        console.log(`🔄 Closing position for EOD: ${trade.symbol} (P&L: ${plPercentage.toFixed(2)}%)`);
        await this.closePosition(trade, currentPrice, 'eod_auto_close');
      } else {
        console.log(`✅ Keeping position open: ${trade.symbol} (P&L above ${config.eod_close_premium_percent}%)`);
      }

    } catch (error) {
      console.error(`❌ Error evaluating trade ${trade.id} for EOD closure:`, error);
    }
  }

  private async closePosition(trade: any, closePrice: number, reason: string): Promise<void> {
    try {
      // Place market sell order
      const sellQuantity = parseFloat(trade.quantity.toString());
      
      console.log(`📤 Placing market sell order for ${trade.symbol}: ${sellQuantity} at market price`);

      const sellOrder = await this.bybitService.placeOrder({
        symbol: trade.symbol,
        side: 'Sell',
        orderType: 'Market',
        qty: sellQuantity.toString(),
      });

      if (sellOrder.orderId) {
        // Calculate final P&L
        const entryPrice = parseFloat(trade.price.toString());
        const profitLoss = (closePrice - entryPrice) * sellQuantity;
        
        // Update trade in database
        const { error } = await supabase
          .from('trades')
          .update({
            status: 'closed',
            profit_loss: profitLoss,
            updated_at: new Date().toISOString()
          })
          .eq('id', trade.id);

        if (error) {
          console.error(`❌ Error updating closed trade ${trade.id}:`, error);
        } else {
          console.log(`✅ Position closed: ${trade.symbol}, P&L: $${profitLoss.toFixed(2)}`);
          await this.logActivity('position_closed', `${reason}: ${trade.symbol}`, {
            tradeId: trade.id,
            symbol: trade.symbol,
            entryPrice,
            closePrice,
            profitLoss,
            reason
          });
        }
      }

    } catch (error) {
      console.error(`❌ Error closing position for trade ${trade.id}:`, error);
      await this.logActivity('system_error', `Failed to close position: ${trade.symbol}`, {
        tradeId: trade.id,
        error: error.message
      });
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
