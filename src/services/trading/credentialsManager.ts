
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { ApiCredentials } from './types';

export class CredentialsManager {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async fetchCredentials(): Promise<BybitService | null> {
    try {
      console.log('Fetching API credentials for MAIN exchange for user:', this.userId);
      
      const { data: credentials, error } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('exchange_name', 'bybit')
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No active API credentials found for user:', this.userId);
          await this.logActivity('error', 'No active API credentials found. Please configure your Bybit MAIN exchange API credentials in the API Setup tab.');
        } else {
          console.error('Error fetching credentials:', error);
          await this.logActivity('error', `Error fetching API credentials: ${error.message}`);
        }
        return null;
      }

      if (credentials && credentials.api_key && credentials.api_secret) {
        console.log('Found valid API credentials for Bybit MAIN exchange:', {
          mainExchange: true,
          apiKey: credentials.api_key ? `${credentials.api_key.substring(0, 8)}...` : 'Missing',
          apiSecret: credentials.api_secret ? 'Present' : 'Missing',
          isActive: credentials.is_active
        });
        
        await this.logActivity('info', `Found API credentials for Bybit MAIN exchange (active: ${credentials.is_active})`);
        
        const bybitService = new BybitService(
          credentials.api_key,
          credentials.api_secret,
          'https://api.bybit.com'
        );

        // Test the connection to verify credentials work on MAIN exchange
        try {
          console.log('Testing API connection using Supabase edge function for MAIN exchange...');
          const { data: testResult, error: testError } = await supabase.functions.invoke('bybit-api', {
            body: {
              endpoint: '/v5/market/tickers',
              method: 'GET',
              params: {
                category: 'spot',
                symbol: 'BTCUSDT'
              },
              isDemoTrading: false, // MAIN exchange
              cacheBust: Math.random().toString()
            }
          });

          if (testError) {
            console.log('MAIN exchange API connection test failed with error:', testError);
            await this.logActivity('error', 'MAIN exchange API connection test failed', { error: testError.message });
          } else if (testResult?.retCode === 0) {
            console.log('MAIN exchange API connection test successful');
            await this.logActivity('info', 'MAIN exchange API connection established successfully', { 
              mainExchange: true,
              response: 'Valid API response received'
            });
          } else {
            console.log('MAIN exchange API connection test failed:', testResult);
            await this.logActivity('error', 'MAIN exchange API connection test failed', { 
              retCode: testResult?.retCode, 
              retMsg: testResult?.retMsg 
            });
          }
        } catch (error) {
          console.log('MAIN exchange API connection test failed:', error);
          await this.logActivity('error', 'MAIN exchange API connection failed', { error: error.message });
        }

        return bybitService;
      } else {
        console.log('API credentials found but missing key or secret');
        await this.logActivity('error', 'API credentials incomplete - missing key or secret');
        return null;
      }
    } catch (error) {
      console.error('Error in credentials management:', error);
      await this.logActivity('error', 'Failed to fetch API credentials', { error: error.message });
      return null;
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: type,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
