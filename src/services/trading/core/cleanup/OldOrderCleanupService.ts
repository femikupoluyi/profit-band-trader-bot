import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from '../TradingLogger';

export class OldOrderCleanupService {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  /**
   * Mark old pending orders as closed (older than 24 hours)
   */
  async markOldPendingOrdersAsClosed(): Promise<void> {
    try {
      console.log('🔄 Marking old pending orders as closed...');

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: oldPending, error: fetchError } = await supabase
        .from('trades')
        .select('id, symbol, side, status, created_at')
        .eq('user_id', this.userId)
        .eq('status', 'pending')
        .lt('created_at', oneDayAgo);

      if (fetchError) {
        console.error('❌ Error fetching old pending orders:', fetchError);
        return;
      }

      if (!oldPending || oldPending.length === 0) {
        console.log('📭 No old pending orders to close');
        return;
      }

      console.log(`🎯 Found ${oldPending.length} old pending orders to close`);

      const { error: updateError } = await supabase
        .from('trades')
        .update({ 
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', this.userId)
        .eq('status', 'pending')
        .lt('created_at', oneDayAgo);

      if (updateError) {
        console.error('❌ Error marking old pending orders as closed:', updateError);
      } else {
        console.log(`✅ Marked ${oldPending.length} old pending orders as closed`);
        await this.logger.log('data_cleanup', `Marked ${oldPending.length} old pending orders as closed`, {
          count: oldPending.length,
          cutoffTime: oneDayAgo,
          type: 'old_pending_cleanup'
        });
      }
    } catch (error) {
      console.error('❌ Error marking old pending orders as closed:', error);
    }
  }
}