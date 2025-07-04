import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './TradingLogger';

export class StaleDataCleanupService {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  /**
   * Clean up stale data that doesn't match current configuration
   */
  async cleanupStaleData(): Promise<void> {
    try {
      console.log('🧹 Starting stale data cleanup...');
      await this.logger.logSystemInfo('Starting stale data cleanup');

      // Get current trading configuration
      const { data: config } = await supabase
        .from('trading_configs')
        .select('trading_pairs')
        .eq('user_id', this.userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      const validSymbols = config?.trading_pairs || [];
      console.log('✅ Current valid symbols:', validSymbols);

      // 1. Mark all sell orders as closed (they represent completed trades)
      await this.markSellOrdersAsClosed();

      // 2. Mark buy orders for invalid symbols as closed
      await this.markInvalidSymbolTradesAsClosed(validSymbols);

      // 3. Mark very old pending orders as closed (older than 24 hours)
      await this.markOldPendingOrdersAsClosed();

      console.log('✅ Stale data cleanup completed');
      await this.logger.logSuccess('Stale data cleanup completed');

    } catch (error) {
      console.error('❌ Error during stale data cleanup:', error);
      await this.logger.logError('Stale data cleanup failed', error);
    }
  }

  private async markSellOrdersAsClosed(): Promise<void> {
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

  private async markInvalidSymbolTradesAsClosed(validSymbols: string[]): Promise<void> {
    try {
      if (validSymbols.length === 0) {
        console.log('⚠️ No valid symbols configured, skipping invalid symbol cleanup');
        return;
      }

      console.log('🔄 Marking trades for invalid symbols as closed...');

      const { data: invalidTrades, error: fetchError } = await supabase
        .from('trades')
        .select('id, symbol, side, status')
        .eq('user_id', this.userId)
        .not('symbol', 'in', `(${validSymbols.map(s => `"${s}"`).join(',')})`)
        .in('status', ['pending', 'filled', 'partial_filled']);

      if (fetchError) {
        console.error('❌ Error fetching invalid symbol trades:', fetchError);
        return;
      }

      if (!invalidTrades || invalidTrades.length === 0) {
        console.log('📭 No invalid symbol trades to close');
        return;
      }

      console.log(`🎯 Found ${invalidTrades.length} trades for invalid symbols to close:`, 
        invalidTrades.map(t => t.symbol));

      const { error: updateError } = await supabase
        .from('trades')
        .update({ 
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', this.userId)
        .not('symbol', 'in', `(${validSymbols.map(s => `"${s}"`).join(',')})`)
        .in('status', ['pending', 'filled', 'partial_filled']);

      if (updateError) {
        console.error('❌ Error marking invalid symbol trades as closed:', updateError);
      } else {
        console.log(`✅ Marked ${invalidTrades.length} invalid symbol trades as closed`);
        await this.logger.log('data_cleanup', `Marked ${invalidTrades.length} invalid symbol trades as closed`, {
          count: invalidTrades.length,
          invalidSymbols: [...new Set(invalidTrades.map(t => t.symbol))],
          validSymbols,
          type: 'invalid_symbols_cleanup'
        });
      }
    } catch (error) {
      console.error('❌ Error marking invalid symbol trades as closed:', error);
    }
  }

  private async markOldPendingOrdersAsClosed(): Promise<void> {
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