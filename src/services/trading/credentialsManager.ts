
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { ApiCredentials } from './types';
import { TradingLogger } from './core/TradingLogger';
import { ErrorHandler } from './core/ErrorHandler';
import { TRADING_ENVIRONMENT } from './core/TypeDefinitions';

export class CredentialsManager {
  private userId: string;
  private logger: TradingLogger;
  private errorHandler: ErrorHandler;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
    this.errorHandler = new ErrorHandler(this.logger);
  }

  async fetchCredentials(): Promise<BybitService | null> {
    try {
      await this.logger.logInfo('Fetching API credentials for DEMO trading', { userId: this.userId });
      
      const { data: credentials, error } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('exchange_name', 'bybit')
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          await this.logger.logError('No active API credentials found. Please configure your Bybit DEMO trading API credentials in the API Setup tab.');
        } else {
          await this.errorHandler.handleApiError(error, 'Fetching API credentials');
        }
        return null;
      }

      if (credentials && credentials.api_key && credentials.api_secret) {
        await this.logger.logInfo('Found valid API credentials for Bybit DEMO trading', {
          demoTrading: TRADING_ENVIRONMENT.isDemoTrading,
          apiKey: credentials.api_key ? `${credentials.api_key.substring(0, 8)}...` : 'Missing',
          apiSecret: credentials.api_secret ? 'Present' : 'Missing',
          isActive: credentials.is_active,
          testnet: credentials.testnet
        });
        
        const bybitService = new BybitService(
          credentials.api_key,
          credentials.api_secret,
          TRADING_ENVIRONMENT.isDemoTrading
        );

        // Test the connection using demo trading
        await this.testApiConnection();
        
        return bybitService;
      } else {
        await this.logger.logError('API credentials incomplete - missing key or secret');
        return null;
      }
    } catch (error) {
      await this.errorHandler.handleSystemError(error, 'Credentials management');
      return null;
    }
  }

  private async testApiConnection(): Promise<void> {
    try {
      await this.logger.logInfo('Testing API connection using Supabase edge function for DEMO trading...');
      
      const { data: testResult, error: testError } = await supabase.functions.invoke('bybit-api', {
        body: {
          endpoint: '/v5/market/tickers',
          method: 'GET',
          params: {
            category: 'spot',
            symbol: 'BTCUSDT'
          },
          isDemoTrading: TRADING_ENVIRONMENT.isDemoTrading,
          cacheBust: Math.random().toString()
        }
      });

      if (testError) {
        await this.errorHandler.handleApiError(testError, 'DEMO trading API connection test');
      } else if (testResult?.retCode === 0) {
        await this.logger.logSuccess('DEMO trading API connection established successfully', { 
          demoTrading: TRADING_ENVIRONMENT.isDemoTrading,
          response: 'Valid API response received'
        });
      } else {
        await this.logger.logError('DEMO trading API connection test failed', { 
          retCode: testResult?.retCode, 
          retMsg: testResult?.retMsg 
        });
      }
    } catch (error) {
      await this.errorHandler.handleApiError(error, 'DEMO trading API connection test');
    }
  }
}
