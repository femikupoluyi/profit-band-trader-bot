import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from '../TradingLogger';

export class OrphanedDataCleanupService {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  /**
   * Clean up orphaned data (trades and signals with null/empty values)
   */
  async cleanupOrphanedData(): Promise<void> {
    try {
      console.log('🔄 Cleaning up orphaned data...');

      await this.cleanupOrphanedTrades();
      await this.cleanupOrphanedSignals();

    } catch (error) {
      console.error('❌ Error cleaning up orphaned data:', error);
    }
  }

  private async cleanupOrphanedTrades(): Promise<void> {
    // Remove trades with null or empty symbols
    const { error: deleteError } = await supabase
      .from('trades')
      .delete()
      .eq('user_id', this.userId)
      .or('symbol.is.null,symbol.eq.');

    if (deleteError) {
      console.error('❌ Error deleting orphaned trades:', deleteError);
    } else {
      console.log('✅ Cleaned up orphaned trades with invalid symbols');
    }
  }

  private async cleanupOrphanedSignals(): Promise<void> {
    // Remove signals with null data
    const { error: signalError } = await supabase
      .from('trading_signals')
      .delete()
      .eq('user_id', this.userId)
      .or('symbol.is.null,signal_type.is.null,price.is.null');

    if (signalError) {
      console.error('❌ Error deleting orphaned signals:', signalError);
    } else {
      console.log('✅ Cleaned up orphaned trading signals');
    }
  }
}