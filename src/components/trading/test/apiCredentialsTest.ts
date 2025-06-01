
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
      return { 
        test: TEST_NAMES.API_CREDENTIALS, 
        status: 'success', 
        message: '✅ Bybit DEMO account API credentials found and active' 
      };
    } else {
      return { 
        test: TEST_NAMES.API_CREDENTIALS, 
        status: 'error', 
        message: '❌ Bybit DEMO account API credentials not found. Please configure them in the API Setup tab.' 
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
