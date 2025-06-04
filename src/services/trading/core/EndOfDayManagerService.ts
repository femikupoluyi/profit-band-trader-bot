
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
        console.log('📭 No trades from today to evaluate for EOD closure');
        return;
      }

      console.log(`🔄 Evaluating ${todayTrades.length} trades for EOD closure`);

      let closedCount = 0;
      let skippedAtLoss = 0;

      for (const trade of todayTrades) {
        const shouldClose = await this.evaluateTradeForEODClosure(trade, config);
        if (shouldClose === 'closed') {
          closedCount++;
        } else if (shouldClose === 'skipped_loss') {
          skippedAtLoss++;
        }
      }

      console.log(`🌅 EOD Management Summary: ${closedCount} trades closed, ${skippedAtLoss} losing trades left open`);
      
      await this.logActivity('system_info', `EOD Management completed: ${closedCount} closed, ${skippedAtLoss} left open (at loss)`, {
        totalEvaluated: todayTrades.length,
        closed: closedCount,
        skippedAtLoss: skippedAtLoss
      });

    } catch (error) {
      console.error('❌ Error managing end of day:', error);
      await this.logActivity('system_error', 'End-of-day management failed', { error: error.message });
      throw error;
    }
  }

  private async evaluateTradeForEODClosure(trade: any, config: TradingConfig): Promise<'closed' | 'skipped_loss' | 'skipped_error'> {
    try {
      console.log(`🌅 Evaluating EOD closure for ${trade.symbol}...`);

      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());
      
      // Calculate current P&L
      const profit = (currentPrice - entryPrice) * quantity;
      const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      console.log(`  Current Price: $${currentPrice.toFixed(4)}`);
      console.log(`  P&L: $${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)`);

      // NEW LOGIC: Do not close trades at a loss at EOD
      if (profit < 0) {
        console.log(`📈 Trade ${trade.symbol} is at a loss ($${profit.toFixed(2)}), leaving open per EOD policy`);
        
        await this.logActivity('position_eod_hold', `EOD: Keeping ${trade.symbol} open (at loss)`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          entryPrice,
          currentPrice,
          profit,
          profitPercent,
          reason: 'eod_no_close_at_loss_policy'
        });

        return 'skipped_loss';
      }

      // Only close profitable trades at EOD
      console.log(`💰 Trade ${trade.symbol} is profitable, proceeding with EOD closure`);
      
      // Calculate EOD sell price with premium (for profitable trades only)
      const eodSellPrice = currentPrice * (1 + config.eod_close_premium_percentage / 100);
      
      console.log(`  EOD Sell Price: $${eodSellPrice.toFixed(4)} (+${config.eod_close_premium_percentage}% premium)`);

      // For now, close at current market price (in real implementation, place limit sell with premium)
      await supabase
        .from('trades')
        .update({
          status: 'closed',
          profit_loss: profit,
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id);

      console.log(`✅ EOD closure: ${trade.symbol} P&L: $${profit.toFixed(2)}`);

      await this.logActivity('position_closed', `EOD closure for profitable ${trade.symbol}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        entryPrice,
        exitPrice: currentPrice,
        profit,
        profitPercent,
        reason: 'end_of_day_auto_close_profitable_only'
      });

      return 'closed';

    } catch (error) {
      console.error(`❌ Error evaluating trade ${trade.id} for EOD closure:`, error);
      await this.logActivity('system_error', `EOD evaluation failed for ${trade.symbol}`, {
        tradeId: trade.id,
        error: error.message
      });
      return 'skipped_error';
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      // Map to valid log types
      const validTypes = [
        'signal_processed', 'trade_executed', 'trade_filled', 'position_closed',
        'system_error', 'order_placed', 'order_failed', 'calculation_error',
        'execution_error', 'signal_rejected', 'order_rejected', 'system_info'
      ];

      const mappedType = validTypes.includes(type) ? type : 'system_info';

      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: mappedType,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
