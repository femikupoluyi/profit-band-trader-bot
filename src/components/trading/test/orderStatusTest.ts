
import { supabase } from '@/integrations/supabase/client';
import { TestResult } from './types';
import { TEST_NAMES, TEST_CONFIG } from './testConstants';

export const runOrderStatusTest = async (orderId: string): Promise<TestResult> => {
  try {
    // Wait a moment for order to process
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.ORDER_STATUS_CHECK_DELAY));
    
    const { data: statusResponse } = await supabase.functions.invoke('bybit-api', {
      body: {
        endpoint: '/v5/order/realtime',
        method: 'GET',
        params: {
          category: 'spot',
          orderId: orderId
        },
        isDemoTrading: true
      }
    });
    
    if (statusResponse?.retCode === 0 && statusResponse.result?.list?.[0]) {
      const orderStatus = statusResponse.result.list[0].orderStatus;
      return { 
        test: TEST_NAMES.ORDER_STATUS, 
        status: 'success', 
        message: `✅ Order status retrieved: ${orderStatus}` 
      };
    } else {
      return { 
        test: TEST_NAMES.ORDER_STATUS, 
        status: 'warning', 
        message: `⚠️ Order status check: ${statusResponse?.retMsg || 'Unable to retrieve status'}` 
      };
    }
  } catch (error) {
    return { 
      test: TEST_NAMES.ORDER_STATUS, 
      status: 'error', 
      message: `❌ Status check failed: ${error}` 
    };
  }
};
