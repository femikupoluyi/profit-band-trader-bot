
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class SignalAnalysisService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async analyzeSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('🔍 Analyzing signals...');
      
      for (const symbol of config.trading_pairs) {
        await this.analyzeSymbol(symbol, config);
      }

      console.log('✅ Signal analysis completed');
    } catch (error) {
      console.error('❌ Error analyzing signals:', error);
      throw error;
    }
  }

  private async analyzeSymbol(symbol: string, config: TradingConfigData): Promise<void> {
    try {
      console.log(`\n🔍 Analyzing ${symbol}...`);

      // Get latest market data for this symbol
      const { data: marketData, error: marketError } = await supabase
        .from('market_data')
        .select('*')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (marketError || !marketData) {
        console.log(`❌ No market data found for ${symbol}`);
        return;
      }

      const currentPrice = parseFloat(marketData.price.toString());
      console.log(`  Current Price: $${currentPrice.toFixed(4)}`);

      // Simple support level calculation (using historical data)
      const supportLevel = await this.calculateSupportLevel(symbol, config);
      
      if (!supportLevel) {
        console.log(`❌ Could not calculate support level for ${symbol}`);
        return;
      }

      console.log(`  Support Level: $${supportLevel.toFixed(4)}`);

      // Check if we should generate a signal
      const entryPrice = supportLevel * (1 + config.entry_offset_percent / 100);
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);

      // Risk constraints check
      const lowerBound = supportLevel * (1 - 5.0 / 100); // 5% below support
      const upperBound = supportLevel * (1 + 2.0 / 100); // 2% above support
      
      console.log(`  Lower Bound: $${lowerBound.toFixed(4)}`);
      console.log(`  Upper Bound: $${upperBound.toFixed(4)}`);

      // Check position limits before generating signal
      const canTrade = await this.checkPositionLimits(symbol, config);
      if (!canTrade) {
        console.log(`❌ Risk constraints failed for ${symbol}`);
        return;
      }

      // Generate signal if price is near support
      if (currentPrice <= entryPrice && currentPrice >= lowerBound) {
        await this.generateBuySignal(symbol, entryPrice, supportLevel);
      } else {
        console.log(`  No signal: Price $${currentPrice.toFixed(4)} not in range [$${lowerBound.toFixed(4)} - $${entryPrice.toFixed(4)}]`);
      }

    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
    }
  }

  private async calculateSupportLevel(symbol: string, config: TradingConfigData): Promise<number | null> {
    try {
      // Get recent price data for support calculation
      const { data: recentPrices, error } = await supabase
        .from('market_data')
        .select('price, timestamp')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(config.support_candle_count);

      if (error || !recentPrices || recentPrices.length < 10) {
        console.log(`❌ Insufficient price data for ${symbol} support calculation`);
        return null;
      }

      // Simple support calculation: find lowest price in recent data
      const prices = recentPrices.map(p => parseFloat(p.price.toString()));
      const supportLevel = Math.min(...prices);
      
      return supportLevel;
    } catch (error) {
      console.error(`Error calculating support level for ${symbol}:`, error);
      return null;
    }
  }

  private async checkPositionLimits(symbol: string, config: TradingConfigData): Promise<boolean> {
    try {
      // Check max active pairs
      const { data: activePairs } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled', 'partial_filled']);

      const uniquePairs = new Set(activePairs?.map(trade => trade.symbol) || []);
      const activePairCount = uniquePairs.size;
      
      // If this symbol is new and we're at max pairs, reject
      if (!uniquePairs.has(symbol) && activePairCount >= config.max_active_pairs) {
        console.log(`❌ Max active pairs limit reached: ${activePairCount}/${config.max_active_pairs}`);
        return false;
      }

      // Check max positions per pair for this specific symbol
      const { count: currentPositions } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled', 'partial_filled']);

      if ((currentPositions || 0) >= config.max_positions_per_pair) {
        console.log(`❌ Max positions per pair reached for ${symbol}: ${currentPositions}/${config.max_positions_per_pair}`);
        return false;
      }

      console.log(`✅ Position limits check passed for ${symbol}: ${currentPositions}/${config.max_positions_per_pair} positions, ${activePairCount}/${config.max_active_pairs} pairs`);
      return true;

    } catch (error) {
      console.error('Error checking position limits:', error);
      return false;
    }
  }

  private async generateBuySignal(symbol: string, entryPrice: number, supportLevel: number): Promise<void> {
    try {
      console.log(`🚀 Generating BUY signal for ${symbol} at $${entryPrice.toFixed(4)}`);

      const { error } = await supabase
        .from('trading_signals')
        .insert({
          user_id: this.userId,
          symbol,
          signal_type: 'buy',
          price: entryPrice,
          confidence: 0.8,
          reasoning: `Price near support level of $${supportLevel.toFixed(4)}`,
          processed: false
        });

      if (error) {
        console.error(`❌ Error generating signal for ${symbol}:`, error);
      } else {
        console.log(`✅ Signal generated for ${symbol}`);
        await this.logActivity('signal_generated', `Buy signal generated for ${symbol}`, {
          symbol,
          entryPrice,
          supportLevel
        });
      }
    } catch (error) {
      console.error(`❌ Error generating signal for ${symbol}:`, error);
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
