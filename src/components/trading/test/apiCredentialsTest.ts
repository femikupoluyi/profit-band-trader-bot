
import { supabase } from '@/integrations/supabase/client';
import { TestResult } from './types';
import { TEST_NAMES } from './testConstants';

export const runApiCredentialsTest = async (userId: string): Promise<TestResult> => {
  try {
    const { data: credentials, error: credError } = await supabase
      .from('api_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('exchange_name', 'bybit')
      .eq('is_active', true)
      .maybeSingle();
    
    if (credError) {
      return { 
        test: TEST_NAMES.API_CREDENTIALS, 
        status: 'error', 
        message: `❌ Error fetching credentials: ${credError.message}` 
      };
    } else if (credentials && credentials.api_key && credentials.api_secret) {
      // Safely access api_url with fallback
      const apiUrl = (credentials as any).api_url || 'https://api-demo.bybit.com';
      return { 
        test: TEST_NAMES.API_CREDENTIALS, 
        status: 'success', 
        message: `✅ Bybit DEMO account API credentials found and active (URL: ${apiUrl})` 
      };
    } else {
      return { 
        test: TEST_NAMES.API_CREDENTIALS, 
        status: 'error', 
        message: '❌ Bybit DEMO account API credentials not found or incomplete. Please configure them in the API Setup tab.' 
      };
    }
  } catch (error) {
    return { 
      test: TEST_NAMES.API_CREDENTIALS, 
      status: 'error', 
      message: `❌ Credentials test failed: ${error}` 
    };
  }
};
