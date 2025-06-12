
import { SupportLevel } from './TypeDefinitions';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export class DataDrivenSupportAnalyzer {
  /**
   * Analyze historical data using multiple methods to identify support levels
   */
  analyzeSupport(candles: CandleData[], config: TradingConfigData): SupportLevel[] {
    console.log(`🔍 Starting data-driven support analysis with ${candles.length} candles`);
    
    const supportLevels: SupportLevel[] = [];
    
    // Method 1: Swing Lows Analysis
    const swingSupports = this.identifySwingLows(candles, config.swing_analysis_bars);
    supportLevels.push(...swingSupports);
    console.log(`📊 Found ${swingSupports.length} swing low support levels`);
    
    // Method 2: Volume Profile Analysis
    const volumeSupports = this.analyzeVolumeProfile(candles, config.volume_lookback_periods);
    supportLevels.push(...volumeSupports);
    console.log(`📊 Found ${volumeSupports.length} volume-based support levels`);
    
    // Method 3: Fibonacci Retracement
    const fibSupports = this.calculateFibonacciSupports(candles, config.fibonacci_sensitivity);
    supportLevels.push(...fibSupports);
    console.log(`📊 Found ${fibSupports.length} Fibonacci support levels`);
    
    // Rank and filter support levels
    const rankedSupports = this.rankSupportLevels(supportLevels, candles);
    console.log(`🎯 Final ranked support levels: ${rankedSupports.length}`);
    
    return rankedSupports;
  }

  /**
   * Identify swing lows as potential support levels
   */
  private identifySwingLows(candles: CandleData[], lookbackBars: number): SupportLevel[] {
    const supports: SupportLevel[] = [];
    
    for (let i = lookbackBars; i < candles.length - lookbackBars; i++) {
      const currentLow = candles[i].low;
      let isSwingLow = true;
      
      // Check if current low is lower than surrounding lows
      for (let j = i - lookbackBars; j <= i + lookbackBars; j++) {
        if (j !== i && candles[j].low <= currentLow) {
          isSwingLow = false;
          break;
        }
      }
      
      if (isSwingLow) {
        // Count how many times price bounced from this level
        const touches = this.countTouches(candles, currentLow, 0.002); // 0.2% tolerance
        
        supports.push({
          price: currentLow,
          strength: Math.min(0.9, touches * 0.15), // Higher strength for more touches
          timestamp: candles[i].timestamp,
          touches: touches
        });
      }
    }
    
    return supports;
  }

  /**
   * Analyze volume profile to identify high-volume price zones
   */
  private analyzeVolumeProfile(candles: CandleData[], lookbackPeriods: number): SupportLevel[] {
    const supports: SupportLevel[] = [];
    const recentCandles = candles.slice(-lookbackPeriods);
    
    // Group candles by price ranges
    const priceRanges: { [key: string]: { volume: number; count: number; avgPrice: number } } = {};
    
    recentCandles.forEach(candle => {
      // Use VWAP (Volume Weighted Average Price) as the key price
      const vwap = (candle.high + candle.low + candle.close) / 3;
      const priceKey = Math.round(vwap * 100) / 100; // Round to 2 decimals
      
      if (!priceRanges[priceKey]) {
        priceRanges[priceKey] = { volume: 0, count: 0, avgPrice: 0 };
      }
      
      priceRanges[priceKey].volume += candle.volume;
      priceRanges[priceKey].count += 1;
      priceRanges[priceKey].avgPrice = (priceRanges[priceKey].avgPrice + vwap) / 2;
    });
    
    // Find high-volume zones
    const totalVolume = Object.values(priceRanges).reduce((sum, range) => sum + range.volume, 0);
    const avgVolume = totalVolume / Object.keys(priceRanges).length;
    
    Object.entries(priceRanges).forEach(([priceKey, range]) => {
      if (range.volume > avgVolume * 1.5) { // 50% above average volume
        supports.push({
          price: range.avgPrice,
          strength: Math.min(0.8, (range.volume / avgVolume) * 0.2),
          timestamp: Date.now(),
          touches: range.count
        });
      }
    });
    
    return supports;
  }

  /**
   * Calculate Fibonacci retracement levels as dynamic supports
   */
  private calculateFibonacciSupports(candles: CandleData[], sensitivity: number): SupportLevel[] {
    const supports: SupportLevel[] = [];
    
    if (candles.length < 50) return supports;
    
    // Find significant moves (high to low) in recent data
    const recentCandles = candles.slice(-100);
    const highs = recentCandles.map(c => c.high);
    const lows = recentCandles.map(c => c.low);
    
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const range = maxHigh - minLow;
    
    // Calculate Fibonacci retracement levels
    const fibLevels = [0.236, 0.382, 0.5, 0.618, 0.786];
    
    fibLevels.forEach(level => {
      const fibPrice = maxHigh - (range * level);
      const touches = this.countTouches(candles, fibPrice, 0.005); // 0.5% tolerance
      
      if (touches >= 2) { // At least 2 touches to be considered valid
        supports.push({
          price: fibPrice,
          strength: Math.min(0.7, level * sensitivity),
          timestamp: Date.now(),
          touches: touches
        });
      }
    });
    
    return supports;
  }

  /**
   * Count how many times price touched a specific level
   */
  private countTouches(candles: CandleData[], targetPrice: number, tolerance: number): number {
    let touches = 0;
    const toleranceAmount = targetPrice * tolerance;
    
    candles.forEach(candle => {
      if (candle.low <= targetPrice + toleranceAmount && candle.low >= targetPrice - toleranceAmount) {
        touches++;
      }
    });
    
    return touches;
  }

  /**
   * Rank support levels by strength and relevance
   */
  private rankSupportLevels(supports: SupportLevel[], candles: CandleData[]): SupportLevel[] {
    if (candles.length === 0) return [];
    
    const currentPrice = candles[candles.length - 1].close;
    
    // Filter supports that are below current price (actual support levels)
    const validSupports = supports.filter(support => support.price < currentPrice);
    
    // Sort by strength and recency
    return validSupports
      .sort((a, b) => {
        const strengthDiff = b.strength - a.strength;
        if (Math.abs(strengthDiff) > 0.1) return strengthDiff;
        
        // If strength is similar, prefer more recent supports
        return b.timestamp - a.timestamp;
      })
      .slice(0, 5); // Return top 5 support levels
  }

  /**
   * Calculate dynamic ATR-based support bounds
   */
  calculateDynamicBounds(candles: CandleData[], atrMultiplier: number): { lowerBound: number; upperBound: number } {
    if (candles.length < 14) {
      return { lowerBound: 5.0, upperBound: 2.0 }; // Fallback to defaults
    }
    
    // Calculate ATR (Average True Range) for the last 14 periods
    const atrPeriod = 14;
    const recentCandles = candles.slice(-atrPeriod);
    
    let atrSum = 0;
    for (let i = 1; i < recentCandles.length; i++) {
      const current = recentCandles[i];
      const previous = recentCandles[i - 1];
      
      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      );
      
      atrSum += tr;
    }
    
    const atr = atrSum / (recentCandles.length - 1);
    const currentPrice = recentCandles[recentCandles.length - 1].close;
    const atrPercent = (atr / currentPrice) * 100;
    
    return {
      lowerBound: atrPercent * atrMultiplier * 2, // 2x ATR for lower bound
      upperBound: atrPercent * atrMultiplier // 1x ATR for upper bound
    };
  }
}
