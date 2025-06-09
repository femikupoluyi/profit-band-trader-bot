
import { supabase } from '@/integrations/supabase/client';
import { TestResult } from './types';
import { TEST_NAMES, TEST_CONFIG, TEST_MESSAGES, getRandomTestSymbol } from './testConstants';

export const runBybitApiTest = async (): Promise<TestResult> => {
  try {
    // Use a random test symbol instead of hard-coded SOL
    const testSymbol = getRandomTestSymbol();
    
    const { data: apiResponse, error: apiError } = await supabase.functions.invoke('bybit-api', {
      body: {
        endpoint: '/v5/market/tickers',
        method: 'GET',
        params: {
          category: 'spot',
          symbol: testSymbol
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
      const symbolName = testSymbol.replace('USDT', '');
      return { 
        test: TEST_NAMES.BYBIT_API, 
        status: 'success', 
        message: `${TEST_MESSAGES.SUCCESS.API_CONNECTION} ${symbolName}: $${price}` 
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
