
import { CandleData, SupportLevel } from './types';

export class SupportLevelAnalyzer {
  identifySupportLevel(candles: CandleData[]): SupportLevel | null {
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
}
