
import { InstrumentInfoFetcher } from './InstrumentInfoFetcher';
import { InstrumentCache } from './InstrumentCache';

// Re-export the type for convenience
export type BybitInstrumentInfo = {
  symbol: string;
  priceDecimals: number;
  quantityDecimals: number;
  minOrderQty: string;
  minOrderAmt: string;
  tickSize: string;
  basePrecision: string;
};

export class BybitInstrumentService {
  /**
   * Get instrument information for a symbol from Bybit (with caching)
   */
  static async getInstrumentInfo(symbol: string): Promise<BybitInstrumentInfo | null> {
    if (!symbol || typeof symbol !== 'string') {
      console.warn('Invalid symbol provided to getInstrumentInfo');
      return null;
    }

    // Check cache first
    const cached = InstrumentCache.getCachedInstrument(symbol);
    if (cached) {
      console.log(`📋 Using cached instrument info for ${symbol}:`, cached);
      return cached;
    }

    // Fetch from API
    const instrumentInfo = await InstrumentInfoFetcher.fetchInstrumentInfo(symbol);
    if (instrumentInfo) {
      // Cache the result
      InstrumentCache.cacheInstrument(symbol, instrumentInfo);
    }

    return instrumentInfo;
  }

  /**
   * Format price according to instrument tick size
   */
  static formatPrice(symbol: string, price: number, instrumentInfo?: BybitInstrumentInfo): string {
    try {
      if (!symbol || price < 0) {
        console.warn('Invalid parameters for formatPrice');
        return price.toFixed(4);
      }

      if (!instrumentInfo) {
        console.warn(`No instrument info provided for ${symbol}, using 4 decimals`);
        return price.toFixed(4);
      }

      const formatted = price.toFixed(instrumentInfo.priceDecimals);
      console.log(`💰 Formatted price for ${symbol}: ${price} -> ${formatted} (${instrumentInfo.priceDecimals} decimals)`);
      return formatted;
    } catch (error) {
      console.error(`Error formatting price for ${symbol}:`, error);
      return price.toFixed(4);
    }
  }

  /**
   * Format quantity according to instrument base precision
   */
  static formatQuantity(symbol: string, quantity: number, instrumentInfo?: BybitInstrumentInfo): string {
    try {
      if (!symbol || quantity < 0) {
        console.warn('Invalid parameters for formatQuantity');
        return quantity.toFixed(4);
      }

      if (!instrumentInfo) {
        console.warn(`No instrument info provided for ${symbol}, using 4 decimals`);
        return quantity.toFixed(4);
      }

      const formatted = quantity.toFixed(instrumentInfo.quantityDecimals);
      console.log(`📦 Formatted quantity for ${symbol}: ${quantity} -> ${formatted} (${instrumentInfo.quantityDecimals} decimals)`);
      return formatted;
    } catch (error) {
      console.error(`Error formatting quantity for ${symbol}:`, error);
      return quantity.toFixed(4);
    }
  }

  /**
   * Validate if order meets minimum requirements
   */
  static validateOrder(symbol: string, price: number, quantity: number, instrumentInfo: BybitInstrumentInfo): boolean {
    try {
      if (!symbol || !instrumentInfo || price <= 0 || quantity <= 0) {
        console.warn('Invalid parameters for validateOrder');
        return false;
      }

      const orderValue = price * quantity;
      const minOrderAmt = parseFloat(instrumentInfo.minOrderAmt);
      const minOrderQty = parseFloat(instrumentInfo.minOrderQty);

      if (isNaN(minOrderAmt) || isNaN(minOrderQty)) {
        console.warn(`Invalid minimum order values for ${symbol}`);
        return false;
      }

      if (quantity < minOrderQty) {
        console.warn(`❌ Quantity ${quantity} below minimum ${minOrderQty} for ${symbol}`);
        return false;
      }

      if (orderValue < minOrderAmt) {
        console.warn(`❌ Order value ${orderValue} below minimum ${minOrderAmt} for ${symbol}`);
        return false;
      }

      console.log(`✅ Order validation passed for ${symbol}: qty=${quantity}, value=${orderValue}`);
      return true;
    } catch (error) {
      console.error(`Error validating order for ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Batch fetch instrument info for multiple symbols
   */
  static async getMultipleInstrumentInfo(symbols: string[]): Promise<Map<string, BybitInstrumentInfo>> {
    const results = new Map<string, BybitInstrumentInfo>();
    
    if (!Array.isArray(symbols)) {
      console.warn('Invalid symbols array provided to getMultipleInstrumentInfo');
      return results;
    }
    
    for (const symbol of symbols) {
      if (symbol && typeof symbol === 'string') {
        const info = await this.getInstrumentInfo(symbol);
        if (info) {
          results.set(symbol, info);
        }
      }
    }
    
    return results;
  }

  /**
   * Clear all cached instrument data
   */
  static clearCache(): void {
    InstrumentCache.clearCache();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; expired: number } {
    return InstrumentCache.getCacheStats();
  }
}
