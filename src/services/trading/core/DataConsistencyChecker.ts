
import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './TradingLogger';

export class DataConsistencyChecker {
  private logger: TradingLogger;

  constructor(userId: string) {
    this.logger = new TradingLogger(userId);
  }

  async validateUserData(userId: string): Promise<boolean> {
    try {
      await this.logger.logSystemInfo('Starting data consistency validation', { userId });

      // Check for orphaned trades without valid trading config
      const orphanedTradesCheck = await this.checkOrphanedTrades(userId);
      
      // Check for invalid trading pairs in config
      const invalidPairsCheck = await this.checkInvalidTradingPairs(userId);
      
      // Check for trades with invalid status values
      const invalidTradeStatusCheck = await this.checkInvalidTradeStatus(userId);
      
      // Check for duplicate active credentials
      const duplicateCredentialsCheck = await this.checkDuplicateCredentials(userId);

      const allChecksPass = orphanedTradesCheck && invalidPairsCheck && 
                           invalidTradeStatusCheck && duplicateCredentialsCheck;

      await this.logger.logSystemInfo('Data consistency validation completed', { 
        userId,
        allChecksPass,
        checks: {
          orphanedTrades: orphanedTradesCheck,
          invalidPairs: invalidPairsCheck,
          invalidTradeStatus: invalidTradeStatusCheck,
          duplicateCredentials: duplicateCredentialsCheck
        }
      });

      return allChecksPass;
    } catch (error) {
      await this.logger.logError('Data consistency validation failed', error, { userId });
      return false;
    }
  }

  private async checkOrphanedTrades(userId: string): Promise<boolean> {
    try {
      const { data: trades, error } = await supabase
        .from('trades')
        .select('id, symbol')
        .eq('user_id', userId)
        .or('symbol.is.null,symbol.eq.');

      if (error) {
        throw error;
      }

      if (trades && trades.length > 0) {
        await this.logger.logSystemInfo('Found orphaned trades with invalid symbols', {
          count: trades.length,
          tradeIds: trades.map(t => t.id)
        });
        return false;
      }

      return true;
    } catch (error) {
      await this.logger.logError('Failed to check orphaned trades', error);
      return false;
    }
  }

  private async checkInvalidTradingPairs(userId: string): Promise<boolean> {
    try {
      const { data: config, error } = await supabase
        .from('trading_configs')
        .select('trading_pairs')
        .eq('user_id', userId)
        .single();

      if (error) {
        throw error;
      }

      if (config && config.trading_pairs) {
        const validPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 
                           'POLUSDT', 'FETUSDT', 'XRPUSDT', 'XLMUSDT'];
        
        const invalidPairs = config.trading_pairs.filter(
          (pair: string) => !validPairs.includes(pair)
        );

        if (invalidPairs.length > 0) {
          await this.logger.logSystemInfo('Found invalid trading pairs in config', {
            invalidPairs
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      await this.logger.logError('Failed to check trading pairs', error);
      return false;
    }
  }

  private async checkInvalidTradeStatus(userId: string): Promise<boolean> {
    try {
      const validStatuses = ['pending', 'filled', 'partial_filled', 'cancelled', 'closed'];
      
      const { data: trades, error } = await supabase
        .from('trades')
        .select('id, status')
        .eq('user_id', userId)
        .not('status', 'in', `(${validStatuses.map(s => `"${s}"`).join(',')})`);

      if (error) {
        throw error;
      }

      if (trades && trades.length > 0) {
        await this.logger.logSystemInfo('Found trades with invalid status', {
          count: trades.length,
          invalidTrades: trades.map(t => ({ id: t.id, status: t.status }))
        });
        return false;
      }

      return true;
    } catch (error) {
      await this.logger.logError('Failed to check trade status', error);
      return false;
    }
  }

  private async checkDuplicateCredentials(userId: string): Promise<boolean> {
    try {
      const { data: credentials, error } = await supabase
        .from('api_credentials')
        .select('id, exchange_name')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      if (credentials && credentials.length > 1) {
        const exchangeCounts = credentials.reduce((acc, cred) => {
          acc[cred.exchange_name] = (acc[cred.exchange_name] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const duplicates = Object.entries(exchangeCounts).filter(([_, count]) => count > 1);

        if (duplicates.length > 0) {
          await this.logger.logSystemInfo('Found duplicate active credentials', {
            duplicates: duplicates.map(([exchange, count]) => ({ exchange, count }))
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      await this.logger.logError('Failed to check duplicate credentials', error);
      return false;
    }
  }
}
