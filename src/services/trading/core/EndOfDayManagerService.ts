
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfig } from '../config/TradingConfigManager';

export class EndOfDayManagerService {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async manageEndOfDay(config: TradingConfig): Promise<void> {
    try {
      if (!config.auto_close_at_end_of_day) {
        console.log('🌅 Auto-close at EOD disabled, skipping');
        return;
      }

      // Check if we're near end of day (for example, after 11 PM)
      const now = new Date();
      const hour = now.getHours();
      
      if (hour < 23) {
        console.log(`🌅 Not yet end of day (${hour}:00), skipping EOD management`);
        return;
      }

      console.log('🌅 Managing end-of-day positions...');

      // Get filled trades from today that are still open
      const today = new Date().toISOString().split('T')[0];
      const { data: todayTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'filled')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);

      if (error) throw error;

      if (!todayTrades || todayTrades.length === 0) {
        console.log('📭 No trades from today to close');
        return;
      }

      console.log(`🔄 Processing ${todayTrades.length} trades for EOD closure`);

      for (const trade of todayTrades) {
        await this.closeTradeAtEOD(trade, config);
      }

    } catch (error) {
      console.error('❌ Error managing end of day:', error);
      throw error;
    }
  }

  private async closeTradeAtEOD(trade: any, config: TradingConfig): Promise<void> {
    try {
      console.log(`🌅 Processing EOD closure for ${trade.symbol}...`);

      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      
      // Calculate EOD sell price with premium
      const eodSellPrice = currentPrice * (1 + config.eod_close_premium_percentage / 100);
      
      console.log(`  Current Price: $${currentPrice.toFixed(4)}`);
      console.log(`  EOD Sell Price: $${eodSellPrice.toFixed(4)} (+${config.eod_close_premium_percentage}%)`);

      // For now, just mark as closed at current price (in real implementation, place limit sell)
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());
      const profit = (currentPrice - entryPrice) * quantity;

      await supabase
        .from('trades')
        .update({
          status: 'closed',
          profit_loss: profit,
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id);

      console.log(`✅ EOD closure: ${trade.symbol} P&L: $${profit.toFixed(2)}`);

      await this.logActivity('position_closed', `EOD closure for ${trade.symbol}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        entryPrice,
        exitPrice: currentPrice,
        profit,
        reason: 'end_of_day_auto_close'
      });

    } catch (error) {
      console.error(`❌ Error closing trade ${trade.id} at EOD:`, error);
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
