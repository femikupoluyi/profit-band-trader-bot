import { BybitInstrumentService } from './BybitInstrumentService';

export class BybitPrecisionFormatter {
  private static instrumentCache = new Map<string, any>();

  /**
   * Format price using Bybit's exact tick size precision - ENHANCED VERSION
   */
  static async formatPrice(symbol: string, price: number): Promise<string> {
    try {
      console.log(`🔧 Formatting price for ${symbol}: ${price}`);
      
      if (!symbol || typeof price !== 'number' || isNaN(price) || price <= 0) {
        throw new Error(`Invalid price parameters: symbol=${symbol}, price=${price}`);
      }

      const instrumentInfo = await this.getInstrumentInfo(symbol);
      const tickSize = parseFloat(instrumentInfo.tickSize);
      
      if (isNaN(tickSize) || tickSize <= 0) {
        throw new Error(`Invalid tick size for ${symbol}: ${instrumentInfo.tickSize}`);
      }

      // Round to nearest tick size using proper rounding
      const roundedPrice = Math.round(price / tickSize) * tickSize;
      
      // ENHANCED: Use string-based decimal calculation for accuracy
      const decimals = this.getDecimalPlaces(instrumentInfo.tickSize);
      const formatted = this.formatToDecimals(roundedPrice, decimals);
      
      console.log(`✅ Price formatted for ${symbol}: ${price} → "${formatted}" (tick: ${tickSize}, decimals: ${decimals})`);
      
      // Validation: ensure no scientific notation
      if (formatted.toLowerCase().includes('e')) {
        throw new Error(`Scientific notation in formatted price: ${formatted}`);
      }
      
      return formatted;
    } catch (error) {
      console.error(`❌ Error formatting price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Format quantity using Bybit's exact base precision - ENHANCED VERSION
   */
  static async formatQuantity(symbol: string, quantity: number): Promise<string> {
    try {
      console.log(`🔧 Formatting quantity for ${symbol}: ${quantity}`);
      
      if (!symbol || typeof quantity !== 'number' || isNaN(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity parameters: symbol=${symbol}, quantity=${quantity}`);
      }

      const instrumentInfo = await this.getInstrumentInfo(symbol);
      const basePrecision = parseFloat(instrumentInfo.basePrecision);
      
      if (isNaN(basePrecision) || basePrecision <= 0) {
        throw new Error(`Invalid base precision for ${symbol}: ${instrumentInfo.basePrecision}`);
      }

      // Round DOWN to nearest base precision increment
      const roundedQuantity = Math.floor(quantity / basePrecision) * basePrecision;
      
      // ENHANCED: Use string-based decimal calculation for accuracy
      const decimals = this.getDecimalPlaces(instrumentInfo.basePrecision);
      const formatted = this.formatToDecimals(roundedQuantity, decimals);
      
      console.log(`✅ Quantity formatted for ${symbol}: ${quantity} → "${formatted}" (base: ${basePrecision}, decimals: ${decimals})`);
      
      // Validation: ensure it's a valid multiple of basePrecision
      const testValue = parseFloat(formatted);
      const multipleCheck = Math.abs((testValue / basePrecision) - Math.round(testValue / basePrecision)) < 1e-10;
      
      if (!multipleCheck) {
        throw new Error(`Quantity ${formatted} is not a valid multiple of basePrecision ${basePrecision} for ${symbol}`);
      }

      // Validation: ensure no scientific notation
      if (formatted.toLowerCase().includes('e')) {
        throw new Error(`Scientific notation in formatted quantity: ${formatted}`);
      }
      
      return formatted;
    } catch (error) {
      console.error(`❌ Error formatting quantity for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * ENHANCED: Get decimal places from precision string using string parsing
   */
  private static getDecimalPlaces(precisionStr: string): number {
    try {
      // Convert to string and find decimal places
      const str = parseFloat(precisionStr).toString();
      
      if (str.includes('.')) {
        const decimals = str.split('.')[1].length;
        // Cap at reasonable maximum to prevent excessive precision
        return Math.min(decimals, 8);
      }
      
      return 0;
    } catch (error) {
      console.warn(`Error calculating decimal places for ${precisionStr}:`, error);
      return 4; // Safe fallback
    }
  }

  /**
   * ENHANCED: Format number to specific decimal places without scientific notation
   */
  private static formatToDecimals(value: number, decimals: number): string {
    try {
      // Use toFixed to avoid scientific notation
      const formatted = value.toFixed(decimals);
      
      // Remove trailing zeros for cleaner output (but keep at least the required precision)
      const cleanFormatted = parseFloat(formatted).toFixed(decimals);
      
      return cleanFormatted;
    } catch (error) {
      console.error(`Error formatting ${value} to ${decimals} decimals:`, error);
      throw error;
    }
  }

  /**
   * Validate order meets Bybit minimum requirements
   */
  static async validateOrder(symbol: string, price: number, quantity: number): Promise<boolean> {
    try {
      const instrumentInfo = await this.getInstrumentInfo(symbol);
      
      const minOrderQty = parseFloat(instrumentInfo.minOrderQty);
      const minOrderAmt = parseFloat(instrumentInfo.minOrderAmt);
      const basePrecision = parseFloat(instrumentInfo.basePrecision);
      const tickSize = parseFloat(instrumentInfo.tickSize);
      const orderValue = price * quantity;

      console.log(`🔍 Validating order for ${symbol}:`);
      console.log(`  - Quantity: ${quantity} (min: ${minOrderQty}, precision: ${basePrecision})`);
      console.log(`  - Price: ${price} (tick: ${tickSize})`);
      console.log(`  - Order value: ${orderValue} (min: ${minOrderAmt})`);

      // Check minimum quantity
      if (quantity < minOrderQty) {
        console.error(`❌ Quantity ${quantity} below minimum ${minOrderQty} for ${symbol}`);
        return false;
      }

      // Check minimum order amount
      if (orderValue < minOrderAmt) {
        console.error(`❌ Order value ${orderValue} below minimum ${minOrderAmt} for ${symbol}`);
        return false;
      }

      // CRITICAL: Check quantity precision - must be exact multiple of basePrecision
      const quantityCheck = Math.abs((quantity / basePrecision) - Math.round(quantity / basePrecision)) < 1e-10;
      if (!quantityCheck) {
        console.error(`❌ Quantity ${quantity} is not a valid multiple of basePrecision ${basePrecision} for ${symbol}`);
        return false;
      }

      // Check price precision - must be exact multiple of tickSize  
      const priceCheck = Math.abs((price / tickSize) - Math.round(price / tickSize)) < 1e-10;
      if (!priceCheck) {
        console.error(`❌ Price ${price} is not a valid multiple of tickSize ${tickSize} for ${symbol}`);
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

  /**
   * Clear cache - force fresh data fetch
   */
  static clearCache(): void {
    this.instrumentCache.clear();
    BybitInstrumentService.clearCache();
    console.log('🧹 Cleared BybitPrecisionFormatter cache');
  }
}
