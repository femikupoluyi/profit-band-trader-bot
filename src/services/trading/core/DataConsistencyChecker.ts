import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './TradingLogger';

export class DataConsistencyChecker {
  private logger: TradingLogger;

  constructor(userId: string) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId is required for DataConsistencyChecker');
    }
    this.logger = new TradingLogger(userId);
  }

  async validateUserData(userId: string): Promise<boolean> {
    if (!userId || typeof userId !== 'string') {
      await this.logger.logError('Invalid userId provided to validateUserData', new Error('Invalid userId'));
      return false;
    }

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

      // Check for data type consistency
      const dataTypeCheck = await this.checkDataTypeConsistency(userId);

      const allChecksPass = orphanedTradesCheck && invalidPairsCheck && 
                           invalidTradeStatusCheck && duplicateCredentialsCheck && dataTypeCheck;

      await this.logger.logSystemInfo('Data consistency validation completed', { 
        userId,
        allChecksPass,
        checks: {
          orphanedTrades: orphanedTradesCheck,
          invalidPairs: invalidPairsCheck,
          invalidTradeStatus: invalidTradeStatusCheck,
          duplicateCredentials: duplicateCredentialsCheck,
          dataTypeConsistency: dataTypeCheck
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
        .select('id, symbol, user_id')
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

      // Also check for trades without proper user_id
      const { data: userlessTrades, error: userlessError } = await supabase
        .from('trades')
        .select('id')
        .is('user_id', null);

      if (userlessError) {
        throw userlessError;
      }

      if (userlessTrades && userlessTrades.length > 0) {
        await this.logger.logSystemInfo('Found trades without user_id', {
          count: userlessTrades.length
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
        if (error.code === 'PGRST116') {
          // No config found - this is handled elsewhere
          return true;
        }
        throw error;
      }

      if (config && config.trading_pairs) {
        const validPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 
                           'POLUSDT', 'FETUSDT', 'XRPUSDT', 'XLMUSDT'];
        
        const invalidPairs = config.trading_pairs.filter(
          (pair: string) => typeof pair !== 'string' || !validPairs.includes(pair)
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
        .select('id, exchange_name, user_id')
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

  private async checkDataTypeConsistency(userId: string): Promise<boolean> {
    try {
      let hasIssues = false;

      // Check trades table for proper numeric fields
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('id, price, quantity, profit_loss')
        .eq('user_id', userId)
        .limit(100);

      if (tradesError) {
        throw tradesError;
      }

      if (trades) {
        for (const trade of trades) {
          const price = Number(trade.price);
          const quantity = Number(trade.quantity);
          
          if (isNaN(price) || price <= 0) {
            hasIssues = true;
            await this.logger.logSystemInfo('Found trade with invalid price', {
              tradeId: trade.id,
              price: trade.price
            });
          }
          
          if (isNaN(quantity) || quantity <= 0) {
            hasIssues = true;
            await this.logger.logSystemInfo('Found trade with invalid quantity', {
              tradeId: trade.id,
              quantity: trade.quantity
            });
          }
        }
      }

      // Check trading_signals for proper numeric fields
      const { data: signals, error: signalsError } = await (supabase as any)
        .from('trading_signals')
        .select('id, price, confidence')
        .eq('user_id', userId)
        .limit(100);

      if (signalsError) {
        throw signalsError;
      }

      if (signals) {
        for (const signal of signals) {
          const price = Number(signal.price);
          const confidence = Number(signal.confidence);
          
          if (isNaN(price) || price <= 0) {
            hasIssues = true;
            await this.logger.logSystemInfo('Found signal with invalid price', {
              signalId: signal.id,
              price: signal.price
            });
          }
          
          if (confidence !== null && (isNaN(confidence) || confidence < 0 || confidence > 1)) {
            hasIssues = true;
            await this.logger.logSystemInfo('Found signal with invalid confidence', {
              signalId: signal.id,
              confidence: signal.confidence
            });
          }
        }
      }

      return !hasIssues;
    } catch (error) {
      await this.logger.logError('Failed to check data type consistency', error);
      return false;
    }
  }

  async repairInconsistentData(userId: string): Promise<boolean> {
    if (!userId || typeof userId !== 'string') {
      await this.logger.logError('Invalid userId provided to repairInconsistentData', new Error('Invalid userId'));
      return false;
    }

    try {
      await this.logger.logSystemInfo('Starting data repair process', { userId });

      // Remove trades with invalid symbols
      const { error: deleteTradesError } = await supabase
        .from('trades')
        .delete()
        .eq('user_id', userId)
        .or('symbol.is.null,symbol.eq.');

      if (deleteTradesError) {
        await this.logger.logError('Failed to delete invalid trades', deleteTradesError);
      }

      // Remove signals with invalid data
      const { error: deleteSignalsError } = await (supabase as any)
        .from('trading_signals')
        .delete()
        .eq('user_id', userId)
        .or('symbol.is.null,signal_type.is.null,price.is.null');

      if (deleteSignalsError) {
        await this.logger.logError('Failed to delete invalid signals', deleteSignalsError);
      }

      await this.logger.logSystemInfo('Data repair process completed', { userId });
      return true;
    } catch (error) {
      await this.logger.logError('Data repair process failed', error);
      return false;
    }
  }
}
