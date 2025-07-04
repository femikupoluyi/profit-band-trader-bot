import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from '../TradingLogger';

export class SellOrderCleanupService {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  /**
   * Mark all sell orders as closed (they represent completed trades)
   */
  async markSellOrdersAsClosed(): Promise<void> {
    try {
      console.log('🔄 Marking all sell orders as closed...');

      const { data: sellOrders, error: fetchError } = await supabase
        .from('trades')
        .select('id, symbol, side, status')
        .eq('user_id', this.userId)
        .eq('side', 'sell')
        .in('status', ['filled', 'partial_filled']);

      if (fetchError) {
        console.error('❌ Error fetching sell orders:', fetchError);
        return;
      }

      if (!sellOrders || sellOrders.length === 0) {
        console.log('📭 No sell orders to close');
        return;
      }

      console.log(`🎯 Found ${sellOrders.length} sell orders to close`);

      const { error: updateError } = await supabase
        .from('trades')
        .update({ 
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', this.userId)
        .eq('side', 'sell')
        .in('status', ['filled', 'partial_filled']);

      if (updateError) {
        console.error('❌ Error marking sell orders as closed:', updateError);
      } else {
        console.log(`✅ Marked ${sellOrders.length} sell orders as closed`);
        await this.logger.log('data_cleanup', `Marked ${sellOrders.length} sell orders as closed`, {
          count: sellOrders.length,
          type: 'sell_orders_cleanup'
        });
      }
    } catch (error) {
      console.error('❌ Error marking sell orders as closed:', error);
    }
  }
}