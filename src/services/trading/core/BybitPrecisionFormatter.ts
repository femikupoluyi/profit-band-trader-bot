
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
   * FIXED: No trailing zero removal - use exact precision from basePrecision
   */
  static async formatQuantity(symbol: string, quantity: number): Promise<string> {
    try {
      console.log(`🔧 Formatting quantity for ${symbol}: ${quantity}`);
      
      const instrumentInfo = await this.getInstrumentInfo(symbol);
      const basePrecision = parseFloat(instrumentInfo.basePrecision);
      
      // Round DOWN to nearest base precision increment to avoid "too many decimals"
      const roundedQuantity = Math.floor(quantity / basePrecision) * basePrecision;
      
      // CRITICAL FIX: Use exact decimal places from basePrecision, no trailing zero removal
      const decimals = this.getDecimalPlaces(basePrecision.toString());
      const formatted = roundedQuantity.toFixed(decimals);
      
      console.log(`✅ Quantity formatted for ${symbol}: ${quantity} → "${formatted}" (base: ${basePrecision}, decimals: ${decimals})`);
      console.log(`📊 Precision check: ${roundedQuantity} / ${basePrecision} = ${roundedQuantity / basePrecision} (should be integer)`);
      
      // Validation: Ensure the result is a valid multiple of basePrecision
      const validationCheck = Math.abs((roundedQuantity / basePrecision) - Math.round(roundedQuantity / basePrecision)) < 1e-10;
      if (!validationCheck) {
        throw new Error(`Quantity ${formatted} is not a valid multiple of basePrecision ${basePrecision} for ${symbol}`);
      }
      
      return formatted;
    } catch (error) {
      console.error(`❌ Error formatting quantity for ${symbol}:`, error);
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
