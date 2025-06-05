
import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './core/TradingLogger';

export interface ApiCredentials {
  id: string;
  apiKey: string;
  apiSecret: string;
  exchangeName: string;
  isActive: boolean;
  testnet: boolean;
}

export class CredentialsManager {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  async getActiveCredentials(exchangeName: string = 'bybit'): Promise<ApiCredentials | null> {
    try {
      await this.logger.logSystemInfo(`Fetching active credentials for ${exchangeName}`);

      const { data, error } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('exchange_name', exchangeName)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        await this.logger.logError('Failed to fetch credentials', error);
        throw error;
      }

      if (!data) {
        await this.logger.logSystemInfo(`No active credentials found for ${exchangeName}`);
        return null;
      }

      await this.logger.logSystemInfo(`Active credentials found for ${exchangeName}`);
      
      return {
        id: data.id,
        apiKey: data.api_key,
        apiSecret: data.api_secret,
        exchangeName: data.exchange_name,
        isActive: data.is_active,
        testnet: data.testnet
      };

    } catch (error) {
      await this.logger.logError('Error in getActiveCredentials', error);
      throw error;
    }
  }

  async validateCredentials(credentials: ApiCredentials): Promise<boolean> {
    try {
      // Basic validation
      if (!credentials.apiKey || !credentials.apiSecret) {
        await this.logger.logSystemInfo('Credentials validation failed: missing key or secret');
        return false;
      }

      if (credentials.apiKey.length < 10 || credentials.apiSecret.length < 20) {
        await this.logger.logSystemInfo('Credentials validation failed: key or secret too short');
        return false;
      }

      await this.logger.logSystemInfo('Credentials validation passed');
      return true;

    } catch (error) {
      await this.logger.logError('Error validating credentials', error);
      return false;
    }
  }

  async saveCredentials(apiKey: string, apiSecret: string, exchangeName: string = 'bybit', testnet: boolean = true): Promise<void> {
    try {
      // Deactivate existing credentials
      await supabase
        .from('api_credentials')
        .update({ is_active: false })
        .eq('user_id', this.userId)
        .eq('exchange_name', exchangeName);

      // Insert new credentials
      const { error } = await supabase
        .from('api_credentials')
        .insert({
          user_id: this.userId,
          api_key: apiKey,
          api_secret: apiSecret,
          exchange_name: exchangeName,
          is_active: true,
          testnet: testnet
        });

      if (error) {
        await this.logger.logError('Failed to save credentials', error);
        throw error;
      }

      await this.logger.logSystemInfo(`Credentials saved for ${exchangeName}`);

    } catch (error) {
      await this.logger.logError('Error saving credentials', error);
      throw error;
    }
  }
}
