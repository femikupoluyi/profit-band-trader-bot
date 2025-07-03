import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './TradingLogger';

export class EngineStateManager {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  /**
   * Force synchronize local trade status with Bybit reality
   */
  async forceSyncWithBybit(): Promise<void> {
    try {
      console.log('🔄 EMERGENCY: Force syncing all trades with Bybit...');
      
      // Import and run comprehensive sync
      const { ComprehensiveTradeSync } = await import('./ComprehensiveTradeSync');
      const { CredentialsManager } = await import('../credentialsManager');
      
      const credentialsManager = new CredentialsManager(this.userId);
      const bybitService = await credentialsManager.fetchCredentials();
      
      if (!bybitService) {
        throw new Error('Cannot sync - no Bybit credentials');
      }

      const comprehensiveSync = new ComprehensiveTradeSync(this.userId, bybitService);
      await comprehensiveSync.emergencyFullSync();
      
      console.log('✅ Emergency sync completed');
      await this.logger.logSystemInfo('Emergency sync with Bybit completed');
      
    } catch (error) {
      console.error('❌ Emergency sync failed:', error);
      await this.logger.logError('Emergency sync failed', error);
    }
  }

  /**
   * Clean up stale or inconsistent trades
   */
  async cleanupStaleData(): Promise<void> {
    try {
      console.log('🧹 Cleaning up stale trading data...');
      
      // Mark very old pending orders as failed
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data: staleTrades, error } = await supabase
        .from('trades')
        .select('id, symbol, created_at')
        .eq('user_id', this.userId)
        .eq('status', 'pending')
        .lt('created_at', oneHourAgo);

      if (staleTrades && staleTrades.length > 0) {
        console.log(`🧹 Found ${staleTrades.length} stale pending orders to clean up`);
        
        const { error: updateError } = await supabase
          .from('trades')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', this.userId)
          .eq('status', 'pending')
          .lt('created_at', oneHourAgo);

        if (!updateError) {
          console.log(`✅ Cleaned up ${staleTrades.length} stale pending orders`);
          await this.logger.logSystemInfo(`Cleaned up ${staleTrades.length} stale pending orders`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error cleaning up stale data:', error);
      await this.logger.logError('Error cleaning up stale data', error);
    }
  }

  /**
   * Emergency stop all trading activity
   */
  async emergencyStop(): Promise<void> {
    try {
      console.log('🚨 EMERGENCY STOP - Disabling trading configuration');
      
      // Disable trading configuration
      const { error } = await supabase
        .from('trading_configs')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', this.userId);

      if (error) {
        console.error('❌ Failed to disable trading config:', error);
      } else {
        console.log('✅ Trading configuration disabled');
        await this.logger.logSystemInfo('Emergency stop - trading configuration disabled');
      }
      
    } catch (error) {
      console.error('❌ Error in emergency stop:', error);
      await this.logger.logError('Error in emergency stop', error);
    }
  }
}