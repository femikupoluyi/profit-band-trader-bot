
import { BybitInstrumentService } from './BybitInstrumentService';

export class BybitPrecisionFormatter {
  private static instrumentCache = new Map<string, any>();

  /**
   * Format price using Bybit's exact tick size precision - ALWAYS returns string
   */
  static async formatPrice(symbol: string, price: number): Promise<string> {
    try {
      console.log(`🔧 Formatting price for ${symbol}: ${price}`);
      
      const instrumentInfo = await this.getInstrumentInfo(symbol);
      const tickSize = parseFloat(instrumentInfo.tickSize);
      
      // Round to nearest tick size using proper rounding
      const roundedPrice = Math.round(price / tickSize) * tickSize;
      
      // Format with correct decimal places based on tick size
      const decimals = this.getDecimalPlaces(tickSize.toString());
      const formatted = roundedPrice.toFixed(decimals);
      
      console.log(`✅ Price formatted for ${symbol}: ${price} → "${formatted}" (tick: ${tickSize}, decimals: ${decimals})`);
      return formatted;
    } catch (error) {
      console.error(`❌ Error formatting price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Format quantity using Bybit's exact base precision - ALWAYS returns string
   */
  static async formatQuantity(symbol: string, quantity: number): Promise<string> {
    try {
      console.log(`🔧 Formatting quantity for ${symbol}: ${quantity}`);
      
      const instrumentInfo = await this.getInstrumentInfo(symbol);
      const basePrecision = parseFloat(instrumentInfo.basePrecision);
      
      // Round DOWN to nearest base precision increment to avoid "too many decimals"
      const roundedQuantity = Math.floor(quantity / basePrecision) * basePrecision;
      
      // Format with correct decimal places based on base precision
      const decimals = this.getDecimalPlaces(basePrecision.toString());
      const formatted = roundedQuantity.toFixed(decimals);
      
      // Remove trailing zeros but preserve minimum required decimals
      const finalFormatted = this.removeTrailingZeros(formatted, decimals);
      
      console.log(`✅ Quantity formatted for ${symbol}: ${quantity} → "${finalFormatted}" (base: ${basePrecision}, decimals: ${decimals})`);
      return finalFormatted;
    } catch (error) {
      console.error(`❌ Error formatting quantity for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Remove trailing zeros while preserving minimum required decimals
   */
  private static removeTrailingZeros(value: string, minDecimals: number): string {
    if (value.indexOf('.') === -1) return value;
    
    const [integerPart, decimalPart] = value.split('.');
    let trimmedDecimals = decimalPart.replace(/0+$/, '');
    
    // Ensure we have at least the minimum required decimals
    if (trimmedDecimals.length < minDecimals) {
      trimmedDecimals = trimmedDecimals.padEnd(minDecimals, '0');
    }
    
    return trimmedDecimals.length > 0 ? `${integerPart}.${trimmedDecimals}` : integerPart;
  }

  /**
   * Validate order meets Bybit minimum requirements
   */
  static async validateOrder(symbol: string, price: number, quantity: number): Promise<boolean> {
    try {
      const instrumentInfo = await this.getInstrumentInfo(symbol);
      
      const minOrderQty = parseFloat(instrumentInfo.minOrderQty);
      const minOrderAmt = parseFloat(instrumentInfo.minOrderAmt);
      const orderValue = price * quantity;

      console.log(`🔍 Validating order for ${symbol}: qty=${quantity} (min=${minOrderQty}), value=${orderValue} (min=${minOrderAmt})`);

      if (quantity < minOrderQty) {
        console.error(`❌ Quantity ${quantity} below minimum ${minOrderQty} for ${symbol}`);
        return false;
      }

      if (orderValue < minOrderAmt) {
        console.error(`❌ Order value ${orderValue} below minimum ${minOrderAmt} for ${symbol}`);
        return false;
      }

      console.log(`✅ Order validation passed for ${symbol}`);
      return true;
    } catch (error) {
      console.error(`❌ Error validating order for ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Calculate proper quantity for order amount using Bybit precision  
   */
  static async calculateQuantity(symbol: string, orderAmount: number, price: number): Promise<number> {
    try {
      console.log(`🧮 Calculating quantity for ${symbol}: $${orderAmount} at $${price}`);
      
      const instrumentInfo = await this.getInstrumentInfo(symbol);
      const basePrecision = parseFloat(instrumentInfo.basePrecision);
      
      // Calculate raw quantity
      const rawQuantity = orderAmount / price;
      
      // Round down to nearest base precision increment
      const adjustedQuantity = Math.floor(rawQuantity / basePrecision) * basePrecision;
      
      console.log(`✅ Quantity calculated for ${symbol}: ${rawQuantity} → ${adjustedQuantity} (precision: ${basePrecision})`);
      return adjustedQuantity;
    } catch (error) {
      console.error(`❌ Error calculating quantity for ${symbol}:`, error);
      throw error;
    }
  }

  private static async getInstrumentInfo(symbol: string): Promise<any> {
    // Always fetch fresh data - no caching to avoid stale precision data
    console.log(`📡 Fetching fresh instrument info for ${symbol}`);
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (!instrumentInfo) {
      throw new Error(`Could not get instrument info for ${symbol}`);
    }
    return instrumentInfo;
  }

  private static getDecimalPlaces(value: string): number {
    if (value.indexOf('.') === -1) return 0;
    return value.split('.')[1].length;
  }

  /**
   * Clear cache - force fresh data fetch
   */
  static clearCache(): void {
    this.instrumentCache.clear();
    BybitInstrumentService.clearCache();
    console.log('🧹 Cleared BybitPrecisionFormatter cache');
  }
}
