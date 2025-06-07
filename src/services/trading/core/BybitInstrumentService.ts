
import { supabase } from '@/integrations/supabase/client';

export interface BybitInstrumentInfo {
  symbol: string;
  priceDecimals: number;
  quantityDecimals: number;
  tickSize: string;
  basePrecision: string;
  quotePrecision: string;
  minOrderQty: string;
  maxOrderQty: string;
  minOrderAmt: string;
  maxOrderAmt: string;
}

export class BybitInstrumentService {
  private static instrumentCache: Map<string, BybitInstrumentInfo> = new Map();
  private static cacheExpiry: Map<string, number> = new Map();
  private static readonly CACHE_TTL_MS = 300000; // 5 minutes

  /**
   * Fetch instrument information for a symbol from Bybit
   */
  static async getInstrumentInfo(symbol: string): Promise<BybitInstrumentInfo | null> {
    try {
      // Check cache first
      const cached = this.getCachedInstrument(symbol);
      if (cached) {
        console.log(`📋 Using cached instrument info for ${symbol}:`, cached);
        return cached;
      }

      console.log(`🔍 Fetching instrument info for ${symbol} from Bybit...`);

      const { data: response, error } = await supabase.functions.invoke('bybit-api', {
        body: {
          endpoint: '/v5/market/instruments-info',
          method: 'GET',
          params: {
            category: 'spot',
            symbol: symbol
          },
          isDemoTrading: true
        }
      });

      if (error) {
        console.error(`❌ Error fetching instrument info for ${symbol}:`, error);
        return null;
      }

      if (response?.retCode !== 0) {
        console.error(`❌ Bybit API error for ${symbol}:`, response?.retMsg);
        return null;
      }

      const instrumentList = response.result?.list;
      if (!instrumentList || instrumentList.length === 0) {
        console.error(`❌ No instrument data found for ${symbol}`);
        return null;
      }

      const instrument = instrumentList[0];
      console.log(`📊 Raw instrument data for ${symbol}:`, instrument);

      // Extract decimal places from tickSize and basePrecision
      const priceDecimals = this.getDecimalPlaces(instrument.priceFilter?.tickSize || '0.01');
      const quantityDecimals = this.getDecimalPlaces(instrument.lotSizeFilter?.basePrecision || '0.0001');

      const instrumentInfo: BybitInstrumentInfo = {
        symbol: instrument.symbol,
        priceDecimals,
        quantityDecimals,
        tickSize: instrument.priceFilter?.tickSize || '0.01',
        basePrecision: instrument.lotSizeFilter?.basePrecision || '0.0001',
        quotePrecision: instrument.lotSizeFilter?.quotePrecision || '0.01',
        minOrderQty: instrument.lotSizeFilter?.minOrderQty || '0',
        maxOrderQty: instrument.lotSizeFilter?.maxOrderQty || '999999999',
        minOrderAmt: instrument.lotSizeFilter?.minOrderAmt || '10',
        maxOrderAmt: instrument.lotSizeFilter?.maxOrderAmt || '999999999'
      };

      console.log(`✅ Processed instrument info for ${symbol}:`, instrumentInfo);

      // Cache the result
      this.cacheInstrument(symbol, instrumentInfo);

      return instrumentInfo;
    } catch (error) {
      console.error(`❌ Exception fetching instrument info for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get decimal places from a tick size string (e.g., "0.01" -> 2, "0.0001" -> 4)
   */
  private static getDecimalPlaces(tickSize: string): number {
    try {
      const num = parseFloat(tickSize);
      if (isNaN(num) || num <= 0) {
        console.warn(`Invalid tick size: ${tickSize}, defaulting to 4 decimals`);
        return 4;
      }

      // Convert to string and count decimal places
      const str = num.toString();
      if (str.includes('.')) {
        return str.split('.')[1].length;
      }
      return 0;
    } catch (error) {
      console.error(`Error parsing tick size ${tickSize}:`, error);
      return 4; // Safe default
    }
  }

  /**
   * Format price according to instrument tick size
   */
  static formatPrice(symbol: string, price: number, instrumentInfo?: BybitInstrumentInfo): string {
    try {
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
      const orderValue = price * quantity;
      const minOrderAmt = parseFloat(instrumentInfo.minOrderAmt);
      const minOrderQty = parseFloat(instrumentInfo.minOrderQty);

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
    
    for (const symbol of symbols) {
      const info = await this.getInstrumentInfo(symbol);
      if (info) {
        results.set(symbol, info);
      }
    }
    
    return results;
  }

  private static getCachedInstrument(symbol: string): BybitInstrumentInfo | null {
    const cached = this.instrumentCache.get(symbol);
    const expiry = this.cacheExpiry.get(symbol);
    
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }
    
    // Remove expired cache
    this.instrumentCache.delete(symbol);
    this.cacheExpiry.delete(symbol);
    return null;
  }

  private static cacheInstrument(symbol: string, info: BybitInstrumentInfo): void {
    this.instrumentCache.set(symbol, info);
    this.cacheExpiry.set(symbol, Date.now() + this.CACHE_TTL_MS);
  }

  /**
   * Clear all cached instrument data
   */
  static clearCache(): void {
    this.instrumentCache.clear();
    this.cacheExpiry.clear();
    console.log('🗑️ Instrument cache cleared');
  }
}
