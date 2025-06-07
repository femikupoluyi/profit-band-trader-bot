
import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './TradingLogger';

export class DatabaseConsistencyChecker {
  private logger: TradingLogger;

  constructor(userId: string) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId is required for DatabaseConsistencyChecker');
    }
    this.logger = new TradingLogger(userId);
  }

  async checkUserDataConsistency(userId: string): Promise<boolean> {
    if (!userId || typeof userId !== 'string') {
      await this.logger.logError('Invalid userId provided to checkUserDataConsistency', new Error('Invalid userId'));
      return false;
    }

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
      const orphanedCheck = await this.checkOrphanedRecords(userId);
      
      // Validate data integrity
      const integrityCheck = await this.validateDataIntegrity(userId);

      const overallResult = orphanedCheck && integrityCheck;
      
      await this.logger.logSystemInfo('Database consistency check completed', { 
        userId,
        success: overallResult,
        orphanedCheck,
        integrityCheck
      });
      
      return overallResult;
    } catch (error) {
      await this.logger.logError('Database consistency check failed', error);
      return false;
    }
  }

  private async createDefaultTradingConfig(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('UserId is required to create default trading config');
    }

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

  private async checkOrphanedRecords(userId: string): Promise<boolean> {
    try {
      let hasIssues = false;

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
        hasIssues = true;
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
        hasIssues = true;
        await this.logger.logSystemInfo('Found signals with invalid data', {
          count: invalidSignals.length,
          signalIds: invalidSignals.map(s => s.id)
        });
      }

      return !hasIssues;
    } catch (error) {
      await this.logger.logError('Failed to check orphaned records', error);
      return false;
    }
  }

  private async validateDataIntegrity(userId: string): Promise<boolean> {
    try {
      let hasIssues = false;

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
          hasIssues = true;
          await this.logger.logSystemInfo('Found duplicate active credentials', {
            duplicates: duplicates.map(d => d.id)
          });
        }
      }

      // Validate trading config constraints with proper type handling
      const { data: config, error: configError } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (configError && configError.code !== 'PGRST116') {
        throw new Error(`Failed to validate config: ${configError.message}`);
      }

      if (config) {
        const issues = [];
        
        // Safely convert database values to numbers
        const maxOrderAmount = config.max_order_amount_usd ? Number(config.max_order_amount_usd) : null;
        const takeProfitPercent = config.take_profit_percent ? Number(config.take_profit_percent) : null;
        const maxActivePairs = config.max_active_pairs ? Number(config.max_active_pairs) : null;
        
        if (maxOrderAmount !== null && (isNaN(maxOrderAmount) || maxOrderAmount <= 0)) {
          issues.push('max_order_amount_usd must be a positive number');
        }
        
        if (takeProfitPercent !== null && (isNaN(takeProfitPercent) || takeProfitPercent <= 0)) {
          issues.push('take_profit_percent must be a positive number');
        }
        
        if (maxActivePairs !== null && (isNaN(maxActivePairs) || maxActivePairs <= 0)) {
          issues.push('max_active_pairs must be a positive integer');
        }

        // Validate trading pairs array
        if (config.trading_pairs && Array.isArray(config.trading_pairs)) {
          const validPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 'POLUSDT', 'FETUSDT', 'XRPUSDT', 'XLMUSDT'];
          const invalidPairs = config.trading_pairs.filter(pair => !validPairs.includes(pair));
          
          if (invalidPairs.length > 0) {
            issues.push(`Invalid trading pairs found: ${invalidPairs.join(', ')}`);
          }
        }

        if (issues.length > 0) {
          hasIssues = true;
          await this.logger.logSystemInfo('Found trading config validation issues', { issues });
        }
      }

      // Validate trade statuses
      const validStatuses = ['pending', 'filled', 'partial_filled', 'cancelled', 'closed'];
      const { data: invalidStatusTrades, error: statusError } = await supabase
        .from('trades')
        .select('id, status')
        .eq('user_id', userId)
        .not('status', 'in', `(${validStatuses.map(s => `"${s}"`).join(',')})`);

      if (statusError) {
        throw new Error(`Failed to check trade statuses: ${statusError.message}`);
      }

      if (invalidStatusTrades && invalidStatusTrades.length > 0) {
        hasIssues = true;
        await this.logger.logSystemInfo('Found trades with invalid status', {
          count: invalidStatusTrades.length,
          invalidTrades: invalidStatusTrades.map(t => ({ id: t.id, status: t.status }))
        });
      }

      return !hasIssues;
    } catch (error) {
      await this.logger.logError('Failed to validate data integrity', error);
      return false;
    }
  }

  async cleanupOldData(userId: string): Promise<void> {
    if (!userId || typeof userId !== 'string') {
      await this.logger.logError('Invalid userId provided to cleanupOldData', new Error('Invalid userId'));
      return;
    }

    try {
      // Clean up old processed signals (older than 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error: signalsError } = await supabase
        .from('trading_signals')
        .delete()
        .eq('user_id', userId)
        .eq('processed', true)
        .lt('created_at', sevenDaysAgo);

      if (signalsError) {
        await this.logger.logError('Failed to cleanup old signals', signalsError);
      }

      // Clean up old logs (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: logsError } = await supabase
        .from('trading_logs')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', thirtyDaysAgo);

      if (logsError) {
        await this.logger.logError('Failed to cleanup old logs', logsError);
      }

      await this.logger.logSystemInfo('Data cleanup completed successfully', { userId });
    } catch (error) {
      await this.logger.logError('Data cleanup failed', error);
    }
  }

  async validateUserInputs(userId: string, data: any): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!userId || typeof userId !== 'string') {
      errors.push('Invalid user ID');
    }

    if (!data || typeof data !== 'object') {
      errors.push('Invalid data object');
      return { isValid: false, errors };
    }

    // Validate common trading config inputs
    if (data.max_order_amount_usd !== undefined) {
      const amount = Number(data.max_order_amount_usd);
      if (isNaN(amount) || amount <= 0 || amount > 100000) {
        errors.push('Max order amount must be between 0 and 100,000 USD');
      }
    }

    if (data.take_profit_percent !== undefined) {
      const percent = Number(data.take_profit_percent);
      if (isNaN(percent) || percent <= 0 || percent > 100) {
        errors.push('Take profit percent must be between 0 and 100');
      }
    }

    if (data.max_active_pairs !== undefined) {
      const pairs = Number(data.max_active_pairs);
      if (isNaN(pairs) || !Number.isInteger(pairs) || pairs <= 0 || pairs > 50) {
        errors.push('Max active pairs must be an integer between 1 and 50');
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}
