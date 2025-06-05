
export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface SupportLevel {
  price: number;
  strength: number;
  timestamp: number;
  touches: number;
}

export class SupportLevelAnalyzer {
  /**
   * Identify support levels from historical price data
   */
  identifySupportLevel(candles: CandleData[]): SupportLevel | null {
    if (candles.length < 10) {
      return null;
    }

    // Simple support level identification
    // Look for price levels that have been tested multiple times
    const lowPrices = candles.map(c => c.low).sort((a, b) => a - b);
    const priceGroups: { [key: string]: number } = {};
    
    // Group similar prices (within 0.5% tolerance)
    for (const price of lowPrices) {
      const key = Math.round(price * 200) / 200; // Round to nearest 0.005
      priceGroups[key] = (priceGroups[key] || 0) + 1;
    }

    // Find the price level with most touches
    let bestSupport: SupportLevel | null = null;
    let maxTouches = 2; // Minimum touches to be considered support

    for (const [priceStr, touches] of Object.entries(priceGroups)) {
      const price = parseFloat(priceStr);
      if (touches >= maxTouches) {
        maxTouches = touches;
        bestSupport = {
          price,
          strength: touches / candles.length, // Normalize strength
          timestamp: Date.now(),
          touches
        };
      }
    }

    return bestSupport;
  }

  /**
   * Check if current price is near a support level
   */
  isPriceNearSupport(currentPrice: number, supportLevel: SupportLevel, tolerancePercent: number = 0.5): boolean {
    const tolerance = supportLevel.price * (tolerancePercent / 100);
    return Math.abs(currentPrice - supportLevel.price) <= tolerance;
  }

  /**
   * Calculate support strength based on multiple factors
   */
  calculateSupportStrength(level: SupportLevel, recentCandles: CandleData[]): number {
    let strength = level.touches * 0.3; // Base strength from touches
    
    // Add recency factor
    const age = Date.now() - level.timestamp;
    const ageHours = age / (1000 * 60 * 60);
    const recencyFactor = Math.max(0, 1 - (ageHours / 24)); // Decay over 24 hours
    
    strength += recencyFactor * 0.4;
    
    // Add volume factor if available
    const nearbyCandles = recentCandles.filter(c => 
      Math.abs(c.low - level.price) / level.price < 0.01
    );
    
    if (nearbyCandles.length > 0) {
      const avgVolume = nearbyCandles.reduce((sum, c) => sum + c.volume, 0) / nearbyCandles.length;
      const volumeFactor = Math.min(1, avgVolume / 1000000); // Normalize volume
      strength += volumeFactor * 0.3;
    }

    return Math.min(1, strength); // Cap at 1.0
  }
}
