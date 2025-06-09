
import { supabase } from '@/integrations/supabase/client';
import { calculateSideAwarePL, validateNumericValue } from './formatters';
import { getCurrentPrice } from './priceUtils';

interface SimulationResult {
  success: boolean;
  step: string;
  message: string;
  data?: any;
}

export class TradingFlowSimulation {
  private userId: string;
  private testSymbol: string;

  constructor(userId: string, testSymbol: string = 'BTCUSDT') {
    this.userId = userId;
    this.testSymbol = testSymbol;
  }

  /**
   * Simulate the complete trading flow: buy-fill → sell-creation → live price updates → report rendering
   */
  async runCompleteSimulation(): Promise<SimulationResult[]> {
    const results: SimulationResult[] = [];

    try {
      // Step 1: Simulate buy order creation
      const buyResult = await this.simulateBuyOrder();
      results.push(buyResult);
      if (!buyResult.success) return results;

      // Step 2: Simulate buy order fill
      const fillResult = await this.simulateBuyFill(buyResult.data.tradeId);
      results.push(fillResult);
      if (!fillResult.success) return results;

      // Step 3: Simulate price update
      const priceUpdateResult = await this.simulatePriceUpdate();
      results.push(priceUpdateResult);

      // Step 4: Simulate P&L calculation with live prices
      const plResult = await this.simulatePLCalculation(buyResult.data.tradeId);
      results.push(plResult);

      // Step 5: Test report rendering data consistency
      const reportResult = await this.simulateReportRendering();
      results.push(reportResult);

      return results;
    } catch (error) {
      results.push({
        success: false,
        step: 'simulation_error',
        message: `Simulation failed: ${error}`
      });
      return results;
    }
  }

  private async simulateBuyOrder(): Promise<SimulationResult> {
    try {
      const currentPrice = await getCurrentPrice(this.testSymbol, this.userId);
      if (!currentPrice) {
        return {
          success: false,
          step: 'buy_order_creation',
          message: `Could not get current price for ${this.testSymbol}`
        };
      }

      const quantity = 0.001; // Small test quantity
      const { data, error } = await supabase
        .from('trades')
        .insert({
          user_id: this.userId,
          symbol: this.testSymbol,
          side: 'buy',
          quantity: quantity,
          price: currentPrice,
          status: 'pending',
          order_type: 'market'
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          step: 'buy_order_creation',
          message: `Failed to create buy order: ${error.message}`
        };
      }

      return {
        success: true,
        step: 'buy_order_creation',
        message: `✅ Buy order created for ${this.testSymbol} at $${currentPrice}`,
        data: { tradeId: data.id, price: currentPrice, quantity }
      };
    } catch (error) {
      return {
        success: false,
        step: 'buy_order_creation',
        message: `Buy order creation failed: ${error}`
      };
    }
  }

  private async simulateBuyFill(tradeId: string): Promise<SimulationResult> {
    try {
      // Simulate a slight price difference on fill
      const originalTrade = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (!originalTrade.data) {
        return {
          success: false,
          step: 'buy_fill_simulation',
          message: 'Could not find original trade'
        };
      }

      const originalPrice = parseFloat(originalTrade.data.price.toString());
      const fillPrice = originalPrice * (1 + (Math.random() * 0.002 - 0.001)); // ±0.1% variance

      const { error } = await supabase
        .from('trades')
        .update({
          status: 'filled',
          buy_fill_price: fillPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId);

      if (error) {
        return {
          success: false,
          step: 'buy_fill_simulation',
          message: `Failed to update trade to filled: ${error.message}`
        };
      }

      return {
        success: true,
        step: 'buy_fill_simulation',
        message: `✅ Buy order filled at $${fillPrice.toFixed(4)} (original: $${originalPrice.toFixed(4)})`,
        data: { fillPrice, originalPrice }
      };
    } catch (error) {
      return {
        success: false,
        step: 'buy_fill_simulation',
        message: `Buy fill simulation failed: ${error}`
      };
    }
  }

  private async simulatePriceUpdate(): Promise<SimulationResult> {
    try {
      const currentPrice = await getCurrentPrice(this.testSymbol, this.userId);
      if (!currentPrice) {
        return {
          success: false,
          step: 'price_update',
          message: `Could not get updated price for ${this.testSymbol}`
        };
      }

      // Simulate storing market data
      const { error } = await supabase
        .from('market_data')
        .insert({
          symbol: this.testSymbol,
          price: currentPrice,
          timestamp: new Date().toISOString(),
          source: 'simulation'
        });

      if (error) {
        console.warn('Could not store market data:', error);
      }

      return {
        success: true,
        step: 'price_update',
        message: `✅ Price updated for ${this.testSymbol}: $${currentPrice}`,
        data: { currentPrice }
      };
    } catch (error) {
      return {
        success: false,
        step: 'price_update',
        message: `Price update failed: ${error}`
      };
    }
  }

  private async simulatePLCalculation(tradeId: string): Promise<SimulationResult> {
    try {
      const { data: trade } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (!trade) {
        return {
          success: false,
          step: 'pl_calculation',
          message: 'Could not find trade for P&L calculation'
        };
      }

      const entryPrice = validateNumericValue(trade.price, 'entry price');
      const fillPrice = trade.buy_fill_price ? validateNumericValue(trade.buy_fill_price, 'fill price') : null;
      const quantity = validateNumericValue(trade.quantity, 'quantity');
      const currentPrice = await getCurrentPrice(this.testSymbol, this.userId);

      if (!currentPrice) {
        return {
          success: false,
          step: 'pl_calculation',
          message: 'Could not get current price for P&L calculation'
        };
      }

      const unrealizedPL = calculateSideAwarePL(
        trade.side,
        entryPrice,
        currentPrice,
        quantity,
        fillPrice,
        trade.status
      );

      return {
        success: true,
        step: 'pl_calculation',
        message: `✅ P&L calculated: $${unrealizedPL.toFixed(4)} (Entry: $${entryPrice}, Fill: $${fillPrice || 'N/A'}, Current: $${currentPrice})`,
        data: { unrealizedPL, entryPrice, fillPrice, currentPrice, quantity }
      };
    } catch (error) {
      return {
        success: false,
        step: 'pl_calculation',
        message: `P&L calculation failed: ${error}`
      };
    }
  }

  private async simulateReportRendering(): Promise<SimulationResult> {
    try {
      // Test fetching trades for report
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('symbol', this.testSymbol)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        return {
          success: false,
          step: 'report_rendering',
          message: `Failed to fetch trades for report: ${error.message}`
        };
      }

      // Validate data consistency
      const invalidTrades = trades?.filter(trade => {
        const price = validateNumericValue(trade.price, 'price');
        const quantity = validateNumericValue(trade.quantity, 'quantity');
        return price <= 0 || quantity <= 0;
      }) || [];

      if (invalidTrades.length > 0) {
        return {
          success: false,
          step: 'report_rendering',
          message: `Found ${invalidTrades.length} trades with invalid data`
        };
      }

      return {
        success: true,
        step: 'report_rendering',
        message: `✅ Report data validated: ${trades?.length || 0} trades with consistent data`,
        data: { tradeCount: trades?.length || 0 }
      };
    } catch (error) {
      return {
        success: false,
        step: 'report_rendering',
        message: `Report rendering test failed: ${error}`
      };
    }
  }

  /**
   * Clean up simulation data
   */
  async cleanup(): Promise<void> {
    try {
      // Remove simulation trades
      await supabase
        .from('trades')
        .delete()
        .eq('user_id', this.userId)
        .eq('symbol', this.testSymbol)
        .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Last minute

      // Remove simulation market data
      await supabase
        .from('market_data')
        .delete()
        .eq('symbol', this.testSymbol)
        .eq('source', 'simulation');

    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  }
}

/**
 * Run a quick simulation test
 */
export const runTradingFlowTest = async (userId: string, testSymbol?: string): Promise<boolean> => {
  const simulation = new TradingFlowSimulation(userId, testSymbol);
  
  try {
    const results = await simulation.runCompleteSimulation();
    const success = results.every(result => result.success);
    
    console.log('🧪 Trading Flow Simulation Results:');
    results.forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} ${result.step}: ${result.message}`);
    });
    
    await simulation.cleanup();
    return success;
  } catch (error) {
    console.error('Trading flow simulation failed:', error);
    await simulation.cleanup();
    return false;
  }
};
