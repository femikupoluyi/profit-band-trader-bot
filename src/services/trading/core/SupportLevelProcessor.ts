
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';

export class SupportLevelProcessor {
  /**
   * Process and format support levels using Bybit precision
   */
  static async formatSupportLevel(symbol: string, supportPrice: number): Promise<number> {
    try {
      console.log(`🔧 Formatting support level for ${symbol}: ${supportPrice}`);
      
      // Format using Bybit precision and parse back to number
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, supportPrice);
      const finalPrice = parseFloat(formattedPrice);
      
      console.log(`✅ Support level formatted for ${symbol}: ${supportPrice} → ${finalPrice}`);
      return finalPrice;
    } catch (error) {
      console.error(`❌ Error formatting support level for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Calculate entry price with proper Bybit precision
   */
  static async calculateFormattedEntryPrice(
    symbol: string, 
    basePrice: number, 
    offsetPercent: number
  ): Promise<number> {
    try {
      const rawEntryPrice = basePrice * (1 + offsetPercent / 100);
      return await this.formatSupportLevel(symbol, rawEntryPrice);
    } catch (error) {
      console.error(`❌ Error calculating formatted entry price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Validate price is within acceptable range for Bybit
   */
  static async validatePriceRange(symbol: string, price: number): Promise<boolean> {
    try {
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, price);
      const parsedPrice = parseFloat(formattedPrice);
      
      // Check if formatting changed the price significantly (more than 0.01%)
      const deviation = Math.abs((price - parsedPrice) / price) * 100;
      
      if (deviation > 0.01) {
        console.warn(`⚠️ Price formatting changed ${symbol} price significantly: ${price} → ${parsedPrice} (${deviation.toFixed(4)}%)`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error validating price range for ${symbol}:`, error);
      return false;
    }
  }
}
