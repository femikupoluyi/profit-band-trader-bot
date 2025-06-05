
import { supabase } from '@/integrations/supabase/client';
import { TestResult } from './types';
import { TEST_NAMES, TEST_SYMBOLS, TEST_CONFIG, TEST_MESSAGES } from './testConstants';

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
        isDemoTrading: TEST_CONFIG.ENVIRONMENT.isDemoTrading
      }
    });
    
    if (apiError) {
      return { 
        test: TEST_NAMES.BYBIT_API, 
        status: 'error', 
        message: `${TEST_MESSAGES.ERROR.API_FAILED}: ${apiError.message}` 
      };
    } else if (apiResponse?.retCode === 0) {
      const price = apiResponse.result?.list?.[0]?.lastPrice;
      return { 
        test: TEST_NAMES.BYBIT_API, 
        status: 'success', 
        message: `${TEST_MESSAGES.SUCCESS.API_CONNECTION} SOL: $${price}` 
      };
    } else {
      return { 
        test: TEST_NAMES.BYBIT_API, 
        status: 'error', 
        message: `${TEST_MESSAGES.ERROR.API_FAILED}: ${apiResponse?.retMsg}` 
      };
    }
  } catch (error) {
    return { 
      test: TEST_NAMES.BYBIT_API, 
      status: 'error', 
      message: `${TEST_MESSAGES.ERROR.API_FAILED}: ${error}` 
    };
  }
};
