
import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './TradingLogger';

export class DatabaseConsistencyChecker {
  private logger: TradingLogger;

  constructor(userId: string) {
    this.logger = new TradingLogger(userId);
  }

  async checkUserDataConsistency(userId: string): Promise<boolean> {
    try {
      await this.logger.logSystemInfo('Starting database consistency check', { userId });

      // Check if user has trading config
      const { data: config, error: configError } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (configError && configError.code !== 'PGRST116') {
        await this.logger.logError('Failed to check trading config', configError);
        return false;
      }

      if (!config) {
        await this.logger.logSystemInfo('No trading config found, creating default config', { userId });
        await this.createDefaultTradingConfig(userId);
      }

      // Check for orphaned records
      await this.checkOrphanedRecords(userId);

      // Validate data integrity
      await this.validateDataIntegrity(userId);

      await this.logger.logSystemInfo('Database consistency check completed successfully', { userId });
      return true;
    } catch (error) {
      await this.logger.logError('Database consistency check failed', error);
      return false;
    }
  }

  private async createDefaultTradingConfig(userId: string): Promise<void> {
    const { error } = await supabase
      .from('trading_configs')
      .insert({
        user_id: userId,
        is_active: false
      });

    if (error) {
      throw new Error(`Failed to create default trading config: ${error.message}`);
    }
  }

  private async checkOrphanedRecords(userId: string): Promise<void> {
    // Check for trades without valid symbols
    const { data: invalidTrades, error: tradesError } = await supabase
      .from('trades')
      .select('id, symbol')
      .eq('user_id', userId)
      .or('symbol.is.null,symbol.eq.');

    if (tradesError) {
      throw new Error(`Failed to check trades: ${tradesError.message}`);
    }

    if (invalidTrades && invalidTrades.length > 0) {
      await this.logger.logSystemInfo('Found trades with invalid symbols', { 
        count: invalidTrades.length,
        tradeIds: invalidTrades.map(t => t.id)
      });
    }

    // Check for signals without valid data
    const { data: invalidSignals, error: signalsError } = await supabase
      .from('trading_signals')
      .select('id, symbol, signal_type')
      .eq('user_id', userId)
      .or('symbol.is.null,signal_type.is.null');

    if (signalsError) {
      throw new Error(`Failed to check signals: ${signalsError.message}`);
    }

    if (invalidSignals && invalidSignals.length > 0) {
      await this.logger.logSystemInfo('Found signals with invalid data', {
        count: invalidSignals.length,
        signalIds: invalidSignals.map(s => s.id)
      });
    }
  }

  private async validateDataIntegrity(userId: string): Promise<void> {
    // Check for duplicate active credentials
    const { data: credentials, error: credError } = await supabase
      .from('api_credentials')
      .select('id, exchange_name')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (credError) {
      throw new Error(`Failed to check credentials: ${credError.message}`);
    }

    if (credentials && credentials.length > 1) {
      const duplicates = credentials.filter((cred, index, arr) => 
        arr.findIndex(c => c.exchange_name === cred.exchange_name) !== index
      );

      if (duplicates.length > 0) {
        await this.logger.logSystemInfo('Found duplicate active credentials', {
          duplicates: duplicates.map(d => d.id)
        });
      }
    }

    // Validate trading config constraints
    const { data: config, error: configError } = await supabase
      .from('trading_configs')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (configError) {
      throw new Error(`Failed to validate config: ${configError.message}`);
    }

    if (config) {
      const issues = [];
      
      if (config.max_order_amount_usd && config.max_order_amount_usd <= 0) {
        issues.push('max_order_amount_usd must be positive');
      }
      
      if (config.take_profit_percent && config.take_profit_percent <= 0) {
        issues.push('take_profit_percent must be positive');
      }
      
      if (config.max_active_pairs && config.max_active_pairs <= 0) {
        issues.push('max_active_pairs must be positive');
      }

      if (issues.length > 0) {
        await this.logger.logSystemInfo('Found trading config validation issues', { issues });
      }
    }
  }

  async cleanupOldData(userId: string): Promise<void> {
    try {
      // Clean up old processed signals (older than 7 days)
      const { error: signalsError } = await supabase
        .from('trading_signals')
        .delete()
        .eq('user_id', userId)
        .eq('processed', true)
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (signalsError) {
        await this.logger.logError('Failed to cleanup old signals', signalsError);
      }

      // Clean up old logs (older than 30 days)
      const { error: logsError } = await supabase
        .from('trading_logs')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (logsError) {
        await this.logger.logError('Failed to cleanup old logs', logsError);
      }

      await this.logger.logSystemInfo('Data cleanup completed successfully', { userId });
    } catch (error) {
      await this.logger.logError('Data cleanup failed', error);
    }
  }
}
