
import { supabase } from '@/integrations/supabase/client';
import { TestResult } from './types';
import { TEST_NAMES, TEST_CONFIG } from './testConstants';

export const runAccountBalanceTest = async (): Promise<TestResult> => {
  try {
    const { data: balanceResponse, error: balanceError } = await supabase.functions.invoke('bybit-api', {
      body: {
        endpoint: '/v5/account/wallet-balance',
        method: 'GET',
        params: {
          accountType: TEST_CONFIG.ACCOUNT_TYPE
        },
        isDemoTrading: true
      }
    });
    
    if (balanceError) {
      return { 
        test: TEST_NAMES.ACCOUNT_BALANCE, 
        status: 'error', 
        message: `❌ Balance check failed: ${balanceError.message}` 
      };
    } else if (balanceResponse?.retCode === 0) {
      return { 
        test: TEST_NAMES.ACCOUNT_BALANCE, 
        status: 'success', 
        message: '✅ Account balance access working on DEMO account' 
      };
    } else if (balanceResponse?.retCode === 10001) {
      return { 
        test: TEST_NAMES.ACCOUNT_BALANCE, 
        status: 'error', 
        message: '❌ API signature error - check your API credentials setup' 
      };
    } else if (balanceResponse?.retCode === 10003) {
      return { 
        test: TEST_NAMES.ACCOUNT_BALANCE, 
        status: 'warning', 
        message: '⚠️ API credentials may need trading permissions enabled' 
      };
    } else {
      return { 
        test: TEST_NAMES.ACCOUNT_BALANCE, 
        status: 'warning', 
        message: `⚠️ Balance response: ${balanceResponse?.retMsg}` 
      };
    }
  } catch (error) {
    return { 
      test: TEST_NAMES.ACCOUNT_BALANCE, 
      status: 'error', 
      message: `❌ Balance check error: ${error}` 
    };
  }
};
