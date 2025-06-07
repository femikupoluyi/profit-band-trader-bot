
import { supabase } from '@/integrations/supabase/client';
import { TestResult } from './types';
import { TEST_NAMES, TEST_SYMBOLS } from './testConstants';

export const runBybitApiTest = async (): Promise<TestResult> => {
  try {
    const { data: apiResponse, error: apiError } = await supabase.functions.invoke('bybit-api', {
      body: {
        endpoint: '/v5/market/tickers',
        method: 'GET',
        params: {
          category: 'spot',
          symbol: TEST_SYMBOLS.SOL
        },
        isDemoTrading: true
      }
    });
    
    if (apiError) {
      return { 
        test: TEST_NAMES.BYBIT_API, 
        status: 'error', 
        message: `❌ API Error: ${apiError.message}` 
      };
    } else if (apiResponse?.retCode === 0) {
      const price = apiResponse.result?.list?.[0]?.lastPrice;
      return { 
        test: TEST_NAMES.BYBIT_API, 
        status: 'success', 
        message: `✅ Bybit DEMO account API working! SOL: $${price}` 
      };
    } else {
      return { 
        test: TEST_NAMES.BYBIT_API, 
        status: 'error', 
        message: `❌ API returned error: ${apiResponse?.retMsg}` 
      };
    }
  } catch (error) {
    return { 
      test: TEST_NAMES.BYBIT_API, 
      status: 'error', 
      message: `❌ Connection failed: ${error}` 
    };
  }
};
