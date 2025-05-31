import { supabase } from '@/integrations/supabase/client';
import { TradingSignal, CandleData, SupportLevel } from './types';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class SignalAnalyzer {
  private userId: string;
  private config: TradingConfigData;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
  }

  async analyzeAndCreateSignals(): Promise<void> {
    // Use trading pairs from config
    const symbols = this.config.trading_pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 'POLUSDT', 'FETUSDT', 'XRPUSDT', 'XLMUSDT'];
    
    for (const symbol of symbols) {
      try {
        // Check if we already have an open position for this pair
        const hasOpenPosition = await this.hasOpenPosition(symbol);
        if (hasOpenPosition) {
          console.log(`Skipping ${symbol} - already has open position`);
          continue;
        }

        // Get 72 candles of historical data
        const candles = await this.getCandleData(symbol, 72);
        if (!candles || candles.length < 72) {
          console.log(`Not enough candle data for ${symbol}`);
          continue;
        }

        // Identify support level
        const supportLevel = this.identifySupportLevel(candles);
        if (!supportLevel) {
          console.log(`No clear support level found for ${symbol}`);
          continue;
        }

        // Get current price
        const { data: latestPrice } = await (supabase as any)
          .from('market_data')
          .select('price')
          .eq('symbol', symbol)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (!latestPrice) continue;

        const currentPrice = parseFloat(latestPrice.price);
        
        // Calculate entry price (0.5-1% above support)
        const entryOffsetPercent = this.config.entry_offset_percent || 1.0;
        const entryPrice = supportLevel.price * (1 + entryOffsetPercent / 100);
        
        // Calculate take profit price (2% above entry)
        const takeProfitPercent = this.config.take_profit_percent || 2.0;
        const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);

        // Check if current price is near our entry level
        if (currentPrice <= entryPrice && currentPrice >= supportLevel.price) {
          const signal: TradingSignal = {
            symbol,
            action: 'buy',
            price: currentPrice,
            confidence: supportLevel.strength,
            reasoning: `Support level at ${supportLevel.price.toFixed(4)}, entry at ${entryPrice.toFixed(4)}, TP at ${takeProfitPrice.toFixed(4)}`,
            supportLevel: supportLevel.price,
            takeProfitPrice: takeProfitPrice,
          };

          console.log(`Generated buy signal for ${symbol}:`, signal);
          await this.createSignal(signal);
        } else {
          console.log(`${symbol}: Current price ${currentPrice} not in entry range (${supportLevel.price.toFixed(4)} - ${entryPrice.toFixed(4)})`);
        }
      } catch (error) {
        console.error(`Error analyzing ${symbol}:`, error);
      }
    }
  }

  private async getCandleData(symbol: string, count: number): Promise<CandleData[]> {
    try {
      // Get recent market data as candles (simplified - in real implementation you'd get proper OHLCV data)
      const { data: marketData } = await (supabase as any)
        .from('market_data')
        .select('price, timestamp')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(count * 2); // Get more data to simulate candles

      if (!marketData || marketData.length < count) {
        return [];
      }

      // Convert price data to simplified candle data
      const candles: CandleData[] = [];
      for (let i = 0; i < Math.min(count, marketData.length - 1); i += 2) {
        const price1 = parseFloat(marketData[i].price);
        const price2 = parseFloat(marketData[i + 1]?.price || marketData[i].price);
        
        candles.push({
          timestamp: new Date(marketData[i].timestamp).getTime(),
          open: price2,
          high: Math.max(price1, price2),
          low: Math.min(price1, price2),
          close: price1,
          volume: 0 // Not available in our simplified data
        });
      }

      return candles;
    } catch (error) {
      console.error(`Error getting candle data for ${symbol}:`, error);
      return [];
    }
  }

  private identifySupportLevel(candles: CandleData[]): SupportLevel | null {
    try {
      // Extract all low points
      const lows = candles.map(c => c.low);
      
      // Group similar price levels (within 0.5% of each other)
      const tolerance = 0.005; // 0.5%
      const supportLevels: Map<number, { count: number; prices: number[] }> = new Map();

      for (const low of lows) {
        let foundGroup = false;
        
        for (const [level, data] of supportLevels.entries()) {
          if (Math.abs(low - level) / level <= tolerance) {
            data.count++;
            data.prices.push(low);
            foundGroup = true;
            break;
          }
        }
        
        if (!foundGroup) {
          supportLevels.set(low, { count: 1, prices: [low] });
        }
      }

      // Find the support level with the most touches
      let bestSupport: SupportLevel | null = null;
      let maxTouches = 0;

      for (const [level, data] of supportLevels.entries()) {
        if (data.count >= 3 && data.count > maxTouches) { // At least 3 touches
          const avgPrice = data.prices.reduce((sum, p) => sum + p, 0) / data.prices.length;
          bestSupport = {
            price: avgPrice,
            strength: Math.min(data.count / 10, 1), // Normalize to 0-1
            touchCount: data.count
          };
          maxTouches = data.count;
        }
      }

      if (bestSupport) {
        console.log(`Found support level: ${bestSupport.price.toFixed(4)} with ${bestSupport.touchCount} touches`);
      }

      return bestSupport;
    } catch (error) {
      console.error('Error identifying support level:', error);
      return null;
    }
  }

  private async hasOpenPosition(symbol: string): Promise<boolean> {
    try {
      const { count } = await (supabase as any)
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled']);

      return count > 0;
    } catch (error) {
      console.error(`Error checking open position for ${symbol}:`, error);
      return false;
    }
  }

  private async createSignal(signal: TradingSignal): Promise<void> {
    try {
      await (supabase as any)
        .from('trading_signals')
        .insert({
          user_id: this.userId,
          symbol: signal.symbol,
          signal_type: signal.action,
          price: signal.price,
          confidence: signal.confidence,
          reasoning: signal.reasoning,
          processed: false,
        });

      await this.logActivity('scan', `Generated ${signal.action} signal for ${signal.symbol}`, signal);
      console.log(`Signal created for ${signal.symbol}:`, signal);
    } catch (error) {
      console.error('Error creating signal:', error);
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await (supabase as any)
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
