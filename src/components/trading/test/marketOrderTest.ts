
import { supabase } from '@/integrations/supabase/client';
import { TestResult } from './types';
import { TEST_NAMES, TEST_SYMBOLS, TEST_CONFIG } from './testConstants';

export const runMarketOrderTest = async (): Promise<TestResult> => {
  try {
    // Get current BTC price to calculate quantity for $20
    const { data: priceResponse } = await supabase.functions.invoke('bybit-api', {
      body: {
        endpoint: '/v5/market/tickers',
        method: 'GET',
        params: {
          category: 'spot',
          symbol: TEST_SYMBOLS.BTC
        },
        isDemoTrading: true
      }
    });
    
    if (priceResponse?.retCode === 0) {
      const btcPrice = parseFloat(priceResponse.result?.list?.[0]?.lastPrice || '0');
      const quantity = (TEST_CONFIG.TEST_ORDER_AMOUNT / btcPrice).toFixed(6);
      
      const { data: orderResponse, error: orderError } = await supabase.functions.invoke('bybit-api', {
        body: {
          endpoint: '/v5/order/create',
          method: 'POST',
          params: {
            category: 'spot',
            symbol: TEST_SYMBOLS.BTC,
            side: 'Buy',
            orderType: 'Market',
            qty: quantity,
            timeInForce: TEST_CONFIG.ORDER_TIME_IN_FORCE
          },
          isDemoTrading: true
        }
      });
      
      if (orderError) {
        return { 
          test: TEST_NAMES.MARKET_ORDER, 
          status: 'error', 
          message: `❌ Order placement failed: ${orderError.message}` 
        };
      } else if (orderResponse?.retCode === 0) {
        const orderId = orderResponse.result?.orderId;
        return { 
          test: TEST_NAMES.MARKET_ORDER, 
          status: 'success', 
          message: `✅ $${TEST_CONFIG.TEST_ORDER_AMOUNT} market order placed successfully on DEMO! Order ID: ${orderId}`,
          orderId 
        };
      } else if (orderResponse?.retCode === 10003) {
        return { 
          test: TEST_NAMES.MARKET_ORDER, 
          status: 'warning', 
          message: '⚠️ Order placement unauthorized - trading permissions may be required' 
        };
      } else {
        return { 
          test: TEST_NAMES.MARKET_ORDER, 
          status: 'error', 
          message: `❌ Order failed: ${orderResponse?.retMsg}` 
        };
      }
    } else {
      return { 
        test: TEST_NAMES.MARKET_ORDER, 
        status: 'error', 
        message: '❌ Could not get BTC price for order calculation' 
      };
    }
  } catch (error) {
    return { 
      test: TEST_NAMES.MARKET_ORDER, 
      status: 'error', 
      message: `❌ Order test failed: ${error}` 
    };
  }
};
