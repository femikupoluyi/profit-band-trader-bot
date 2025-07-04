import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from '../TradingLogger';
import { SellOrderCleanupService } from './SellOrderCleanupService';
import { InvalidSymbolCleanupService } from './InvalidSymbolCleanupService';
import { OldOrderCleanupService } from './OldOrderCleanupService';
import { OrphanedDataCleanupService } from './OrphanedDataCleanupService';
import { DataConsistencyValidator } from './DataConsistencyValidator';

/**
 * REFACTORED: Orchestrates comprehensive stale data cleanup
 * using focused, single-responsibility services
 */
export class StaleDataCleanupOrchestrator {
  private userId: string;
  private logger: TradingLogger;
  private sellOrderCleanup: SellOrderCleanupService;
  private invalidSymbolCleanup: InvalidSymbolCleanupService;
  private oldOrderCleanup: OldOrderCleanupService;
  private orphanedDataCleanup: OrphanedDataCleanupService;
  private dataValidator: DataConsistencyValidator;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
    this.sellOrderCleanup = new SellOrderCleanupService(userId);
    this.invalidSymbolCleanup = new InvalidSymbolCleanupService(userId);
    this.oldOrderCleanup = new OldOrderCleanupService(userId);
    this.orphanedDataCleanup = new OrphanedDataCleanupService(userId);
    this.dataValidator = new DataConsistencyValidator(userId);
  }

  /**
   * Execute comprehensive stale data cleanup
   */
  async executeCleanup(): Promise<void> {
    try {
      console.log('🧹 Starting comprehensive stale data cleanup...');
      await this.logger.logSystemInfo('Starting comprehensive stale data cleanup');

      // Get current trading configuration
      const validSymbols = await this.getCurrentValidSymbols();
      console.log('✅ Current valid symbols:', validSymbols);

      // Execute cleanup operations in sequence
      await this.sellOrderCleanup.markSellOrdersAsClosed();
      await this.invalidSymbolCleanup.markInvalidSymbolTradesAsClosed(validSymbols);
      await this.oldOrderCleanup.markOldPendingOrdersAsClosed();
      await this.orphanedDataCleanup.cleanupOrphanedData();
      await this.dataValidator.validateDataConsistency();

      console.log('✅ Comprehensive stale data cleanup completed');
      await this.logger.logSuccess('Comprehensive stale data cleanup completed');

    } catch (error) {
      console.error('❌ Error during stale data cleanup:', error);
      await this.logger.logError('Stale data cleanup failed', error);
    }
  }

  private async getCurrentValidSymbols(): Promise<string[]> {
    const { data: config } = await supabase
      .from('trading_configs')
      .select('trading_pairs')
      .eq('user_id', this.userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    return config?.trading_pairs || [];
  }
}