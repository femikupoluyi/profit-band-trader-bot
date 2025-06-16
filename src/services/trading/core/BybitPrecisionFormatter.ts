import { BybitInstrumentService } from './BybitInstrumentService';

export class BybitPrecisionFormatter {
  private static instrumentCache = new Map<string, any>();

  /**
   * Format price using Bybit's exact tick size precision - FIXED VERSION
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
      
      // FIXED: Calculate decimal places directly from tickSize string
      const decimals = this.calculateDecimalsFromTickSize(instrumentInfo.tickSize);
      const formatted = roundedPrice.toFixed(decimals);
      
      console.log(`✅ Price formatted for ${symbol}: ${price} → "${formatted}" (tick: ${tickSize}, decimals: ${decimals})`);
      
      return formatted;
    } catch (error) {
      console.error(`❌ Error formatting price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Format quantity using Bybit's exact base precision - FIXED VERSION
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
      
      // FIXED: Calculate decimal places directly from basePrecision string
      const decimals = this.calculateDecimalsFromBasePrecision(instrumentInfo.basePrecision);
      const formatted = roundedQuantity.toFixed(decimals);
      
      console.log(`✅ Quantity formatted for ${symbol}: ${quantity} → "${formatted}" (base: ${basePrecision}, decimals: ${decimals})`);
      
      return formatted;
    } catch (error) {
      console.error(`❌ Error formatting quantity for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * FIXED: Calculate decimal places from Bybit's tickSize string
   */
  private static calculateDecimalsFromTickSize(tickSize: string): number {
    try {
      console.log(`🔍 Calculating decimals from tickSize: "${tickSize}"`);
      
      // Handle scientific notation (e.g., "1e-8" becomes "0.00000001")
      const num = parseFloat(tickSize);
      if (isNaN(num)) {
        console.warn(`Invalid tickSize: ${tickSize}, using default 4`);
        return 4;
      }

      // Convert to fixed notation to count decimals
      const fixedStr = num.toFixed(20); // Use high precision
      const dotIndex = fixedStr.indexOf('.');
      
      if (dotIndex === -1) {
        console.log(`No decimals in tickSize ${tickSize}`);
        return 0;
      }

      // Count trailing zeros and non-zero digits
      let decimals = 0;
      for (let i = fixedStr.length - 1; i > dotIndex; i--) {
        if (fixedStr[i] !== '0') {
          decimals = i - dotIndex;
          break;
        }
      }
      
      // Cap at reasonable maximum
      decimals = Math.min(decimals, 8);
      console.log(`✅ Calculated ${decimals} decimals from tickSize "${tickSize}"`);
      return decimals;
    } catch (error) {
      console.warn(`Error calculating decimals for tickSize ${tickSize}:`, error);
      return 4; // Safe fallback
    }
  }

  /**
   * FIXED: Calculate decimal places from Bybit's basePrecision string
   */
  private static calculateDecimalsFromBasePrecision(basePrecision: string): number {
    try {
      console.log(`🔍 Calculating decimals from basePrecision: "${basePrecision}"`);
      
      // Handle scientific notation and whole numbers
      const num = parseFloat(basePrecision);
      if (isNaN(num)) {
        console.warn(`Invalid basePrecision: ${basePrecision}, using default 4`);
        return 4;
      }

      // For whole numbers (like "1"), return 0 decimals
      if (num >= 1) {
        console.log(`Whole number basePrecision ${basePrecision}, using 0 decimals`);
        return 0;
      }

      // Convert to fixed notation to count decimals
      const fixedStr = num.toFixed(20); // Use high precision
      const dotIndex = fixedStr.indexOf('.');
      
      if (dotIndex === -1) {
        return 0;
      }

      // Count trailing zeros and non-zero digits
      let decimals = 0;
      for (let i = fixedStr.length - 1; i > dotIndex; i--) {
        if (fixedStr[i] !== '0') {
          decimals = i - dotIndex;
          break;
        }
      }
      
      // Cap at reasonable maximum
      decimals = Math.min(decimals, 8);
      console.log(`✅ Calculated ${decimals} decimals from basePrecision "${basePrecision}"`);
      return decimals;
    } catch (error) {
      console.warn(`Error calculating decimals for basePrecision ${basePrecision}:`, error);
      return 4; // Safe fallback
    }
  }

  /**
   * Validate order meets Bybit minimum requirements - ENHANCED VERSION
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
      const quantityRemainder = Number(((quantity / basePrecision) % 1).toFixed(10));
      if (quantityRemainder > 0.0000000001) {
        console.error(`❌ Quantity ${quantity} is not a valid multiple of basePrecision ${basePrecision} for ${symbol} (remainder: ${quantityRemainder})`);
        return false;
      }

      // Check price precision - must be exact multiple of tickSize  
      const priceRemainder = Number(((price / tickSize) % 1).toFixed(10));
      if (priceRemainder > 0.0000000001) {
        console.error(`❌ Price ${price} is not a valid multiple of tickSize ${tickSize} for ${symbol} (remainder: ${priceRemainder})`);
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
