
import { SupportLevel } from './TypeDefinitions';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export class DataDrivenSupportAnalyzer {
  analyzeSupport(candles: CandleData[], config: TradingConfigData): SupportLevel[] {
    if (!candles || candles.length < config.swing_analysis_bars) {
      console.warn('Insufficient candle data for DataDriven analysis');
      return [];
    }

    console.log(`🧠 DataDriven Analysis: Using ${config.swing_analysis_bars} bars for swing analysis`);
    
    // Analyze swing lows for support levels
    const swingLows = this.findSwingLows(candles, config.swing_analysis_bars);
    
    // Convert swing lows to support levels
    const supportLevels = swingLows.map((swingLow, index) => {
      const strength = this.calculateSupportStrength(swingLow, candles, config);
      const touches = this.countTouches(swingLow.price, candles, 0.001); // 0.1% tolerance
      
      return {
        price: swingLow.price,
        strength: strength,
        timestamp: swingLow.timestamp,
        touches: touches
      } as SupportLevel;
    });

    // Sort by strength (highest first)
    return supportLevels
      .filter(level => level.strength > 0.3) // Minimum strength threshold
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 3); // Return top 3 support levels
  }

  calculateDynamicBounds(candles: CandleData[], atrMultiplier: number): { lowerBound: number; upperBound: number } {
    if (!candles || candles.length < 14) {
      return { lowerBound: 5.0, upperBound: 2.0 }; // Fallback to static bounds
    }

    // Calculate ATR (Average True Range) for the last 14 periods
    const atr = this.calculateATR(candles.slice(-14));
    const currentPrice = candles[candles.length - 1]?.close || 0;
    
    if (currentPrice === 0) {
      return { lowerBound: 5.0, upperBound: 2.0 };
    }

    // Calculate dynamic bounds based on ATR
    const atrPercent = (atr / currentPrice) * 100;
    const dynamicLowerBound = Math.max(1.0, atrPercent * atrMultiplier * 2); // ATR * multiplier * 2 for lower bound
    const dynamicUpperBound = Math.max(0.5, atrPercent * atrMultiplier); // ATR * multiplier for upper bound

    console.log(`📊 Dynamic ATR Bounds: ATR=${atr.toFixed(6)}, ATR%=${atrPercent.toFixed(2)}%, Lower=${dynamicLowerBound.toFixed(2)}%, Upper=${dynamicUpperBound.toFixed(2)}%`);

    return {
      lowerBound: Math.min(dynamicLowerBound, 10.0), // Cap at 10%
      upperBound: Math.min(dynamicUpperBound, 5.0)   // Cap at 5%
    };
  }

  private findSwingLows(candles: CandleData[], lookbackPeriods: number): Array<{ price: number; timestamp: number; index: number }> {
    const swingLows: Array<{ price: number; timestamp: number; index: number }> = [];
    const halfPeriod = Math.floor(lookbackPeriods / 2);

    for (let i = halfPeriod; i < candles.length - halfPeriod; i++) {
      const currentLow = candles[i].low;
      let isSwingLow = true;

      // Check if current low is lower than surrounding candles
      for (let j = i - halfPeriod; j <= i + halfPeriod; j++) {
        if (j !== i && candles[j].low <= currentLow) {
          isSwingLow = false;
          break;
        }
      }

      if (isSwingLow) {
        swingLows.push({
          price: currentLow,
          timestamp: candles[i].timestamp,
          index: i
        });
      }
    }

    return swingLows;
  }

  private calculateSupportStrength(swingLow: { price: number; timestamp: number; index: number }, candles: CandleData[], config: TradingConfigData): number {
    let strength = 0.0;

    // Factor 1: Volume analysis at swing low
    const volumeStrength = this.analyzeVolumeAtLevel(swingLow, candles, config.volume_lookback_periods);
    strength += volumeStrength * 0.4;

    // Factor 2: Number of touches/tests of this level
    const touches = this.countTouches(swingLow.price, candles, 0.002); // 0.2% tolerance
    const touchStrength = Math.min(touches / 5, 1.0); // Normalize to max 1.0
    strength += touchStrength * 0.3;

    // Factor 3: Fibonacci retracement levels
    const fibStrength = this.checkFibonacciLevel(swingLow, candles, config.fibonacci_sensitivity);
    strength += fibStrength * 0.3;

    return Math.min(strength, 1.0);
  }

  private analyzeVolumeAtLevel(swingLow: { price: number; timestamp: number; index: number }, candles: CandleData[], lookbackPeriods: number): number {
    const startIndex = Math.max(0, swingLow.index - lookbackPeriods);
    const endIndex = Math.min(candles.length - 1, swingLow.index + lookbackPeriods);
    
    const volumes = candles.slice(startIndex, endIndex + 1).map(c => c.volume);
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const swingLowVolume = candles[swingLow.index]?.volume || 0;

    // Higher volume at swing low indicates stronger support
    return Math.min(swingLowVolume / avgVolume / 2, 1.0);
  }

  private countTouches(price: number, candles: CandleData[], tolerance: number): number {
    let touches = 0;
    const toleranceRange = price * tolerance;

    for (const candle of candles) {
      if (Math.abs(candle.low - price) <= toleranceRange) {
        touches++;
      }
    }

    return touches;
  }

  private checkFibonacciLevel(swingLow: { price: number; timestamp: number; index: number }, candles: CandleData[], sensitivity: number): number {
    // Find recent swing high to calculate Fibonacci levels
    const recentHigh = this.findRecentSwingHigh(candles, swingLow.index);
    if (!recentHigh) return 0.0;

    const range = recentHigh.price - swingLow.price;
    const fibLevels = [0.236, 0.382, 0.5, 0.618, 0.786].map(ratio => 
      swingLow.price + (range * ratio)
    );

    // Check if swing low aligns with major Fibonacci levels
    for (const fibLevel of fibLevels) {
      const tolerance = range * 0.02; // 2% tolerance
      if (Math.abs(swingLow.price - fibLevel) <= tolerance) {
        return sensitivity; // Return sensitivity as strength multiplier
      }
    }

    return 0.0;
  }

  private findRecentSwingHigh(candles: CandleData[], fromIndex: number): { price: number; timestamp: number } | null {
    let maxHigh = 0;
    let maxTimestamp = 0;

    // Look for highest high in the 50 candles before the swing low
    const startIndex = Math.max(0, fromIndex - 50);
    
    for (let i = startIndex; i < fromIndex; i++) {
      if (candles[i].high > maxHigh) {
        maxHigh = candles[i].high;
        maxTimestamp = candles[i].timestamp;
      }
    }

    return maxHigh > 0 ? { price: maxHigh, timestamp: maxTimestamp } : null;
  }

  private calculateATR(candles: CandleData[]): number {
    if (candles.length < 2) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];

      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);

      const trueRange = Math.max(tr1, tr2, tr3);
      trueRanges.push(trueRange);
    }

    // Calculate simple moving average of true ranges
    const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
    return atr;
  }
}
