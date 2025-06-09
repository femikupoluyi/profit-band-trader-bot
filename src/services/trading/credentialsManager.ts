
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { ApiCredential } from '@/types/apiCredentials';

export class CredentialsManager {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async fetchCredentials(): Promise<BybitService | null> {
    try {
      console.log('🔑 Fetching API credentials for user:', this.userId);
      
      const { data: credentials, error } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('❌ Error fetching credentials:', error);
        return null;
      }

      if (!credentials) {
        console.log('⚠️ No active credentials found for user');
        return null;
      }

      console.log('✅ Credentials found, initializing BybitService...');
      
      const typedCredentials = credentials as ApiCredential;
      const apiUrl = typedCredentials.api_url || 'https://api-demo.bybit.com';
      console.log('Using API URL:', apiUrl);
      
      const isDemoTrading = typedCredentials.testnet !== false;
      
      return new BybitService(
        typedCredentials.api_key,
        typedCredentials.api_secret,
        isDemoTrading
      );

    } catch (error) {
      console.error('❌ Error in fetchCredentials:', error);
      return null;
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const bybitService = await this.fetchCredentials();
      if (!bybitService) {
        return false;
      }

      const balance = await bybitService.getAccountBalance();
      return balance && balance.retCode === 0;
    } catch (error) {
      console.error('❌ Error validating credentials:', error);
      return false;
    }
  }
}
