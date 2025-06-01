
import { supabase } from '@/integrations/supabase/client';
import { TestResult } from './types';
import { TEST_NAMES, TEST_SYMBOLS, TEST_CONFIG } from './testConstants';

export const runMarketOrderTest = async (): Promise<TestResult> => {
  try {
    // Get current SOL price to calculate quantities for different amounts
    const { data: priceResponse } = await supabase.functions.invoke('bybit-api', {
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
    
    if (priceResponse?.retCode !== 0) {
      return { 
        test: TEST_NAMES.MARKET_ORDER, 
        status: 'error', 
        message: '❌ Could not get SOL price for order calculation' 
      };
    }

    const solPrice = parseFloat(priceResponse.result?.list?.[0]?.lastPrice || '0');
    console.log(`Current SOL price: $${solPrice}`);

    // Test with higher order amounts to meet minimum requirements: $100, $200, $500, $1000
    const testAmounts = [100, 200, 500, 1000];
    const results = [];

    for (const amount of testAmounts) {
      console.log(`\n🧪 Testing market order with $${amount}...`);
      
      const quantity = (amount / solPrice).toFixed(6);
      console.log(`Calculated quantity: ${quantity} SOL for $${amount}`);
      
      const { data: orderResponse, error: orderError } = await supabase.functions.invoke('bybit-api', {
        body: {
          endpoint: '/v5/order/create',
          method: 'POST',
          params: {
            category: 'spot',
            symbol: TEST_SYMBOLS.SOL,
            side: 'Buy',
            orderType: 'Market',
            qty: quantity,
            timeInForce: TEST_CONFIG.ORDER_TIME_IN_FORCE
          },
          isDemoTrading: true
        }
      });
      
      if (orderError) {
        results.push(`❌ $${amount}: ${orderError.message}`);
        continue;
      }
      
      if (orderResponse?.retCode === 0) {
        const orderId = orderResponse.result?.orderId;
        results.push(`✅ $${amount}: Order placed successfully! ID: ${orderId}`);
        
        // Return success on first successful order
        return { 
          test: TEST_NAMES.MARKET_ORDER, 
          status: 'success', 
          message: `✅ Market orders successful! Results:\n${results.join('\n')}`,
          orderId 
        };
      } else if (orderResponse?.retCode === 10003) {
        results.push(`⚠️ $${amount}: Unauthorized (${orderResponse.retMsg})`);
      } else if (orderResponse?.retCode === 170130) {
        results.push(`❌ $${amount}: Order value too small (${orderResponse.retMsg})`);
      } else if (orderResponse?.retCode === 170140) {
        results.push(`❌ $${amount}: Order value exceeded lower limit (${orderResponse.retMsg}) - Min may be higher than $${amount}`);
      } else if (orderResponse?.retCode === 170131) {
        results.push(`❌ $${amount}: Insufficient balance (${orderResponse.retMsg})`);
      } else {
        results.push(`❌ $${amount}: ${orderResponse?.retMsg || 'Unknown error'} (Code: ${orderResponse?.retCode})`);
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // If we get here, no orders were successful
    const hasUnauthorized = results.some(r => r.includes('Unauthorized'));
    const hasInsufficientBalance = results.some(r => r.includes('Insufficient balance'));
    const hasOrderTooSmall = results.some(r => r.includes('Order value exceeded lower limit'));
    
    let status: 'error' | 'warning' = 'error';
    let summaryMessage = '';
    
    if (hasUnauthorized) {
      status = 'warning';
      summaryMessage = '⚠️ All orders unauthorized - trading permissions may be required';
    } else if (hasInsufficientBalance) {
      status = 'warning';
      summaryMessage = '⚠️ Insufficient demo account balance - check your USDT balance';
    } else if (hasOrderTooSmall) {
      status = 'warning';
      summaryMessage = '⚠️ All test amounts below minimum order size - demo account may require $1000+ orders';
    } else {
      summaryMessage = '❌ All market order tests failed';
    }
    
    return { 
      test: TEST_NAMES.MARKET_ORDER, 
      status, 
      message: `${summaryMessage}\n\nDetailed Results:\n${results.join('\n')}\n\n💡 Tip: Demo accounts often have higher minimum order values than live accounts.` 
    };
    
  } catch (error) {
    return { 
      test: TEST_NAMES.MARKET_ORDER, 
      status: 'error', 
      message: `❌ Order test failed: ${error}` 
    };
  }
};
