
import { supabase } from '@/integrations/supabase/client';
import { TradingConfig } from '../config/TradingConfigManager';

export class SignalAnalysisService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async analyzeSignals(config: TradingConfig): Promise<void> {
    try {
      console.log(`🔍 Analyzing signals for ${config.trading_pairs.length} pairs...`);

      for (const symbol of config.trading_pairs) {
        await this.analyzeSymbol(symbol, config);
      }

      console.log('✅ Signal analysis completed');
    } catch (error) {
      console.error('❌ Error analyzing signals:', error);
      throw error;
    }
  }

  private async analyzeSymbol(symbol: string, config: TradingConfig): Promise<void> {
    try {
      console.log(`\n🔍 Analyzing ${symbol}...`);

      // 1. Get current price
      const currentPrice = await this.getCurrentPrice(symbol);
      if (!currentPrice) {
        console.log(`❌ No current price for ${symbol}`);
        return;
      }

      // 2. Calculate support level from recent candles
      const supportLevel = await this.calculateSupportLevel(symbol, config);
      if (!supportLevel) {
        console.log(`❌ Could not calculate support for ${symbol}`);
        return;
      }

      // 3. Calculate entry and bounds
      const entryPrice = supportLevel * (1 + config.entry_above_support_percentage / 100);
      const supportLowerBound = supportLevel * (1 - config.support_lower_bound_percentage / 100);
      const supportUpperBound = entryPrice * (1 + config.support_upper_bound_percentage / 100);

      console.log(`📊 ${symbol} Analysis:`);
      console.log(`  Current Price: $${currentPrice.toFixed(4)}`);
      console.log(`  Support Level: $${supportLevel.toFixed(4)}`);
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      console.log(`  Lower Bound: $${supportLowerBound.toFixed(4)}`);
      console.log(`  Upper Bound: $${supportUpperBound.toFixed(4)}`);

      // 4. Check if current price is within valid range
      if (currentPrice < supportLowerBound || currentPrice > supportUpperBound) {
        console.log(`❌ Price outside valid range for ${symbol}`);
        return;
      }

      // 5. Check risk management constraints
      const riskCheckPassed = await this.checkRiskConstraints(symbol, config);
      if (!riskCheckPassed) {
        console.log(`❌ Risk constraints failed for ${symbol}`);
        return;
      }

      // 6. Create buy signal
      await this.createBuySignal(symbol, entryPrice, supportLevel, supportLowerBound, supportUpperBound);
      console.log(`✅ Buy signal created for ${symbol} at $${entryPrice.toFixed(4)}`);

    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
    }
  }

  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('market_data')
        .select('price')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;
      return parseFloat(data.price.toString());
    } catch (error) {
      return null;
    }
  }

  private async calculateSupportLevel(symbol: string, config: TradingConfig): Promise<number | null> {
    try {
      // For now, use a simple approach: lowest price from recent market data
      // In a real implementation, you'd fetch candle data from the exchange
      const { data, error } = await supabase
        .from('market_data')
        .select('price')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(config.support_analysis_candles);

      if (error || !data || data.length === 0) return null;

      const prices = data.map(row => parseFloat(row.price.toString()));
      const supportLevel = Math.min(...prices);

      return supportLevel;
    } catch (error) {
      return null;
    }
  }

  private async checkRiskConstraints(symbol: string, config: TradingConfig): Promise<boolean> {
    try {
      // Check maximum positions per pair
      const { count: positionsForSymbol } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled']);

      if ((positionsForSymbol || 0) >= config.maximum_positions_per_pair) {
        console.log(`❌ Max positions per pair reached for ${symbol}: ${positionsForSymbol}/${config.maximum_positions_per_pair}`);
        return false;
      }

      // Check maximum active pairs
      const { data: activePairs } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled']);

      const uniquePairs = new Set(activePairs?.map(trade => trade.symbol) || []);
      if (uniquePairs.size >= config.maximum_active_pairs) {
        console.log(`❌ Max active pairs reached: ${uniquePairs.size}/${config.maximum_active_pairs}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking risk constraints:', error);
      return false;
    }
  }

  private async createBuySignal(
    symbol: string, 
    entryPrice: number, 
    supportLevel: number, 
    supportLowerBound: number, 
    supportUpperBound: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('trading_signals')
        .insert({
          user_id: this.userId,
          symbol,
          signal_type: 'buy',
          price: entryPrice,
          confidence: 0.8,
          reasoning: `Buy signal: Entry at ${entryPrice.toFixed(4)}, Support at ${supportLevel.toFixed(4)}`,
          processed: false
        });

      if (error) throw error;

      await this.logActivity('signal_generated', `Buy signal created for ${symbol}`, {
        symbol,
        entryPrice,
        supportLevel,
        supportLowerBound,
        supportUpperBound
      });
    } catch (error) {
      console.error('Error creating buy signal:', error);
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: type,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
