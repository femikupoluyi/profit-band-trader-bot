
import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from '../TradingLogger';

export class DatabasePositionUpdater {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string, logger: TradingLogger) {
    this.userId = userId;
    this.logger = logger;
  }

  async updateClosedPosition(tradeId: string, profitLoss: number, bybitOrderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error: updateError } = await supabase
        .from('trades')
        .update({
          status: 'closed',
          profit_loss: profitLoss,
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId)
        .eq('status', 'filled'); // Only update if still filled (prevent race conditions)

      if (updateError) {
        const errorMsg = `CRITICAL: Bybit close succeeded but database update failed for trade ${tradeId}`;
        await this.logger.logError('Database update failed after Bybit success', updateError, {
          tradeId,
          bybitOrderId,
          profitLoss,
          warning: 'Position closed on Bybit but not in local database - manual intervention required'
        });
        return { success: false, error: errorMsg };
      }

      return { success: true };
    } catch (error) {
      const errorMsg = `Database update exception for trade ${tradeId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await this.logger.logError('Database update exception', error, {
        tradeId,
        bybitOrderId,
        profitLoss
      });
      return { success: false, error: errorMsg };
    }
  }
}
