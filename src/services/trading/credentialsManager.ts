
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
      console.log('Fetching API credentials for user:', this.userId);
      
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
          await this.logActivity('error', 'No active API credentials found. Please configure your Bybit testnet API credentials in the API Setup tab.');
        } else {
          console.error('Error fetching credentials:', error);
          await this.logActivity('error', `Error fetching API credentials: ${error.message}`);
        }
        return null;
      }

      if (credentials && credentials.api_key && credentials.api_secret) {
        console.log('Found valid API credentials for Bybit testnet:', {
          testnet: credentials.testnet,
          apiKey: credentials.api_key ? `${credentials.api_key.substring(0, 8)}...` : 'Missing',
          apiSecret: credentials.api_secret ? 'Present' : 'Missing',
          isActive: credentials.is_active
        });
        
        await this.logActivity('info', `Found API credentials for Bybit testnet (active: ${credentials.is_active})`);
        
        const bybitService = new BybitService({
          apiKey: credentials.api_key,
          apiSecret: credentials.api_secret,
          testnet: credentials.testnet,
        });

        // Test the connection to verify credentials work
        try {
          console.log('Testing API connection...');
          const testResponse = await fetch(`${supabase.supabaseUrl}/functions/v1/bybit-api`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabase.supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              endpoint: '/v5/market/tickers',
              method: 'GET',
              params: {
                category: 'spot',
                symbol: 'BTCUSDT'
              },
              isDemoTrading: true
            })
          });

          const testResult = await testResponse.json();
          
          if (testResult.retCode === 0) {
            console.log('API connection test successful');
            await this.logActivity('info', 'API connection established successfully', { 
              testnet: credentials.testnet,
              response: 'Valid API response received'
            });
          } else {
            console.log('API connection test failed:', testResult);
            await this.logActivity('error', 'API connection test failed', { 
              retCode: testResult.retCode, 
              retMsg: testResult.retMsg 
            });
          }
        } catch (error) {
          console.log('API connection test failed:', error);
          await this.logActivity('error', 'API connection failed', { error: error.message });
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
