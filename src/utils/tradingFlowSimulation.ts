
import { supabase } from '@/integrations/supabase/client';
import { calculateSideAwarePL, validateNumericValue } from '@/utils/formatters';
import { getCurrentPrice } from '@/utils/priceUtils';

/**
 * Comprehensive trading flow simulation
 * Tests: buy-fill → sell-creation → live price updates → report rendering
 */
export const runTradingFlowTest = async (userId: string, testSymbol: string): Promise<boolean> => {
  try {
    console.log(`🧪 Starting comprehensive trading flow test for ${testSymbol}...`);

    // Step 1: Simulate buy order creation and fill
    const buyOrderResult = await simulateBuyOrder(userId, testSymbol);
    if (!buyOrderResult.success) {
      console.error('❌ Buy order simulation failed:', buyOrderResult.error);
      return false;
    }

    const tradeId = buyOrderResult.tradeId;
    console.log(`✅ Buy order simulated: ${tradeId}`);

    // Step 2: Simulate order fill with price slippage
    const fillResult = await simulateOrderFill(tradeId, buyOrderResult.price);
    if (!fillResult.success) {
      console.error('❌ Order fill simulation failed:', fillResult.error);
      return false;
    }

    console.log(`✅ Order fill simulated with price: $${fillResult.fillPrice}`);

    // Step 3: Test live price updates and P&L calculation
    const plResult = await testLivePriceUpdates(tradeId, testSymbol, userId);
    if (!plResult.success) {
      console.error('❌ Live price update test failed:', plResult.error);
      return false;
    }

    console.log(`✅ Live P&L calculation test passed: $${plResult.currentPL}`);

    // Step 4: Test report rendering with the trade data
    const reportResult = await testReportRendering(userId, tradeId);
    if (!reportResult.success) {
      console.error('❌ Report rendering test failed:', reportResult.error);
      return false;
    }

    console.log(`✅ Report rendering test passed`);

    // Step 5: Simulate sell order creation
    const sellResult = await simulateSellOrder(tradeId);
    if (!sellResult.success) {
      console.error('❌ Sell order simulation failed:', sellResult.error);
      return false;
    }

    console.log(`✅ Sell order simulated and trade closed`);

    // Step 6: Cleanup test data
    await cleanupTestTrade(tradeId);
    console.log(`✅ Test trade cleaned up`);

    console.log(`🎉 Complete trading flow test PASSED for ${testSymbol}`);
    return true;

  } catch (error) {
    console.error(`❌ Trading flow test failed with exception:`, error);
    return false;
  }
};

const simulateBuyOrder = async (userId: string, symbol: string) => {
  try {
    const testPrice = 100.0; // Use test price for simulation
    const testQuantity = 1.0;

    const { data: trade, error } = await supabase
      .from('trades')
      .insert({
        user_id: userId,
        symbol,
        side: 'buy',
        order_type: 'market',
        quantity: testQuantity,
        price: testPrice,
        status: 'pending',
        bybit_order_id: `test_${Date.now()}`
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      tradeId: trade.id,
      price: testPrice,
      quantity: testQuantity
    };
  } catch (error) {
    return { success: false, error: error };
  }
};

const simulateOrderFill = async (tradeId: string, originalPrice: number) => {
  try {
    // Simulate realistic price slippage (0.1% to 0.5%)
    const slippage = (Math.random() * 0.4 + 0.1) / 100;
    const fillPrice = originalPrice * (1 + slippage);

    const { error } = await supabase
      .from('trades')
      .update({
        status: 'filled',
        buy_fill_price: fillPrice,
        updated_at: new Date().toISOString()
      })
      .eq('id', tradeId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, fillPrice };
  } catch (error) {
    return { success: false, error: error };
  }
};

const testLivePriceUpdates = async (tradeId: string, symbol: string, userId: string) => {
  try {
    // Get the trade data
    const { data: trade, error } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (error || !trade) {
      return { success: false, error: 'Trade not found' };
    }

    // Simulate current price (different from entry)
    const entryPrice = validateNumericValue(trade.price, 'entry price');
    const fillPrice = trade.buy_fill_price ? validateNumericValue(trade.buy_fill_price, 'fill price') : null;
    const quantity = validateNumericValue(trade.quantity, 'quantity');

    // Test current price that represents a 2% gain
    const currentPrice = entryPrice * 1.02;

    // Calculate P&L using our side-aware function
    const calculatedPL = calculateSideAwarePL(
      trade.side,
      entryPrice,
      currentPrice,
      quantity,
      fillPrice,
      trade.status
    );

    // Verify P&L calculation is reasonable
    const expectedPL = quantity * (currentPrice - (fillPrice || entryPrice));
    const plDifference = Math.abs(calculatedPL - expectedPL);

    if (plDifference > 0.01) {
      return {
        success: false,
        error: `P&L calculation mismatch: calculated=${calculatedPL}, expected=${expectedPL}`
      };
    }

    return { success: true, currentPL: calculatedPL };
  } catch (error) {
    return { success: false, error: error };
  }
};

const testReportRendering = async (userId: string, tradeId: string) => {
  try {
    // Test that the trade appears in various queries
    const { data: activeTrades, error: activeError } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'filled');

    if (activeError) {
      return { success: false, error: activeError.message };
    }

    const testTrade = activeTrades?.find(t => t.id === tradeId);
    if (!testTrade) {
      return { success: false, error: 'Trade not found in active trades query' };
    }

    // Test time-based queries
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: recentTrades, error: recentError } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', oneDayAgo.toISOString())
      .lte('created_at', now.toISOString());

    if (recentError) {
      return { success: false, error: recentError.message };
    }

    const recentTestTrade = recentTrades?.find(t => t.id === tradeId);
    if (!recentTestTrade) {
      return { success: false, error: 'Trade not found in recent trades query' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error };
  }
};

const simulateSellOrder = async (tradeId: string) => {
  try {
    // Simulate realistic profit for the test
    const testProfit = 2.50;

    const { error } = await supabase
      .from('trades')
      .update({
        status: 'closed',
        profit_loss: testProfit,
        updated_at: new Date().toISOString()
      })
      .eq('id', tradeId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error };
  }
};

const cleanupTestTrade = async (tradeId: string) => {
  try {
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', tradeId);

    if (error) {
      console.warn('Warning: Could not cleanup test trade:', error.message);
    }
  } catch (error) {
    console.warn('Warning: Exception during test cleanup:', error);
  }
};

/**
 * Validate P&L calculation logic with various scenarios
 */
export const validatePLCalculationLogic = (): boolean => {
  try {
    console.log('🧪 Testing P&L calculation logic...');

    const testCases = [
      // Buy scenarios
      { side: 'buy', entry: 100, current: 105, quantity: 1, expected: 5, description: 'Buy profitable' },
      { side: 'buy', entry: 100, current: 95, quantity: 1, expected: -5, description: 'Buy loss' },
      { side: 'buy', entry: 50, current: 52, quantity: 2, expected: 4, description: 'Buy multiple quantity' },
      
      // Sell scenarios  
      { side: 'sell', entry: 100, current: 95, quantity: 1, expected: 5, description: 'Sell profitable' },
      { side: 'sell', entry: 100, current: 105, quantity: 1, expected: -5, description: 'Sell loss' },
      { side: 'sell', entry: 200, current: 190, quantity: 0.5, expected: 5, description: 'Sell fractional quantity' }
    ];

    for (const testCase of testCases) {
      const result = calculateSideAwarePL(
        testCase.side,
        testCase.entry,
        testCase.current,
        testCase.quantity,
        null,
        'filled'
      );

      const tolerance = 0.0001;
      if (Math.abs(result - testCase.expected) > tolerance) {
        console.error(`❌ P&L test failed for ${testCase.description}: expected ${testCase.expected}, got ${result}`);
        return false;
      }

      console.log(`✅ P&L test passed: ${testCase.description} - Expected: ${testCase.expected}, Got: ${result}`);
    }

    console.log('✅ All P&L calculation tests passed');
    return true;
  } catch (error) {
    console.error('❌ P&L calculation validation failed:', error);
    return false;
  }
};
