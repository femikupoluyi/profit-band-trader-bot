
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitInstrumentService, BybitInstrumentInfo } from './BybitInstrumentService';
import { InstrumentCache } from './InstrumentCache';

export class ConfigurableFormatter {
  private static config: TradingConfigData | null = null;
  private static activePairs: string[] = [];
  private static instrumentCache: Map<string, BybitInstrumentInfo> = new Map();

  static setConfig(config: TradingConfigData): void {
    this.config = config;
  }

  static setActivePairs(pairs: string[]): void {
    this.activePairs = pairs;
  }

  static getActivePairs(): string[] {
    return this.activePairs;
  }

  /**
   * Format price using dynamic Bybit instrument info
   */
  static async formatPrice(symbol: string, price: number): Promise<string> {
    try {
      if (typeof price !== 'number' || isNaN(price)) {
        console.error(`Invalid price value for ${symbol}:`, price);
        return '0.00';
      }

      // Get instrument info from Bybit
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (instrumentInfo) {
        return BybitInstrumentService.formatPrice(symbol, price, instrumentInfo);
      }

      // Fallback to config or defaults if instrument info unavailable
      if (this.config?.price_decimals_per_symbol?.[symbol] !== undefined) {
        const customDecimals = this.config.price_decimals_per_symbol[symbol];
        if (typeof customDecimals === 'number') {
          return price.toFixed(Math.max(0, Math.min(8, customDecimals)));
        }
      }

      return this.formatPriceWithDefaults(symbol, price);
    } catch (error) {
      console.error(`Error formatting price for ${symbol}:`, error);
      return this.formatPriceWithDefaults(symbol, price);
    }
  }

  /**
   * Format quantity using dynamic Bybit instrument info
   */
  static async formatQuantity(symbol: string, quantity: number): Promise<string> {
    try {
      if (typeof quantity !== 'number' || isNaN(quantity)) {
        console.error(`Invalid quantity value for ${symbol}:`, quantity);
        return '0.0000';
      }

      // Get instrument info from Bybit
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (instrumentInfo) {
        return BybitInstrumentService.formatQuantity(symbol, quantity, instrumentInfo);
      }

      // Fallback to config or defaults if instrument info unavailable
      if (this.config?.quantity_decimals_per_symbol?.[symbol] !== undefined) {
        const customDecimals = this.config.quantity_decimals_per_symbol[symbol];
        if (typeof customDecimals === 'number') {
          return quantity.toFixed(Math.max(0, Math.min(8, customDecimals)));
        }
      }

      return this.formatQuantityWithDefaults(symbol, quantity);
    } catch (error) {
      console.error(`Error formatting quantity for ${symbol}:`, error);
      return this.formatQuantityWithDefaults(symbol, quantity);
    }
  }

  /**
   * Synchronous version using cached instrument info
   */
  static formatPriceSync(symbol: string, price: number): string {
    try {
      const cached = this.instrumentCache.get(symbol);
      if (cached) {
        return BybitInstrumentService.formatPrice(symbol, price, cached);
      }
      return this.formatPriceWithDefaults(symbol, price);
    } catch (error) {
      console.error(`Error in sync price formatting for ${symbol}:`, error);
      return this.formatPriceWithDefaults(symbol, price);
    }
  }

  /**
   * Synchronous version using cached instrument info
   */
  static formatQuantitySync(symbol: string, quantity: number): string {
    try {
      const cached = this.instrumentCache.get(symbol);
      if (cached) {
        return BybitInstrumentService.formatQuantity(symbol, quantity, cached);
      }
      return this.formatQuantityWithDefaults(symbol, quantity);
    } catch (error) {
      console.error(`Error in sync quantity formatting for ${symbol}:`, error);
      return this.formatQuantityWithDefaults(symbol, quantity);
    }
  }

  /**
   * Validate order using Bybit instrument requirements
   */
  static async validateOrder(symbol: string, price: number, quantity: number): Promise<boolean> {
    try {
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (instrumentInfo) {
        return BybitInstrumentService.validateOrder(symbol, price, quantity, instrumentInfo);
      }

      // Fallback validation
      const orderValue = price * quantity;
      return orderValue >= 10; // Basic minimum
    } catch (error) {
      console.error(`Error validating order for ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Pre-cache instrument info for active trading pairs
   */
  static async preloadInstrumentInfo(symbols: string[]): Promise<void> {
    try {
      console.log(`🔄 Preloading instrument info for ${symbols.length} symbols...`);
      const instrumentMap = await BybitInstrumentService.getMultipleInstrumentInfo(symbols);
      
      // Cache the results locally
      for (const [symbol, info] of instrumentMap) {
        this.instrumentCache.set(symbol, info);
      }
      
      console.log(`✅ Preloaded instrument info for ${instrumentMap.size} symbols`);
    } catch (error) {
      console.error('Error preloading instrument info:', error);
    }
  }

  private static formatPriceWithDefaults(symbol: string, price: number): string {
    const defaults: Record<string, number> = {
      'BTCUSDT': 2, 'ETHUSDT': 2, 'BNBUSDT': 2, 'LTCUSDT': 2,
      'SOLUSDT': 4, 'ADAUSDT': 6, 'XRPUSDT': 6, 'DOGEUSDT': 6,
      'MATICUSDT': 6, 'FETUSDT': 6, 'POLUSDT': 4, 'XLMUSDT': 3
    };

    const decimals = defaults[symbol] || 4;
    return price.toFixed(decimals);
  }

  private static formatQuantityWithDefaults(symbol: string, quantity: number): string {
    const defaults: Record<string, number> = {
      'BTCUSDT': 5, 'ETHUSDT': 4, 'SOLUSDT': 2, 'BNBUSDT': 3,
      'ADAUSDT': 0, 'XRPUSDT': 1, 'LTCUSDT': 2, 'POLUSDT': 0,
      'FETUSDT': 0, 'XLMUSDT': 0, 'DOGEUSDT': 0, 'MATICUSDT': 0
    };

    const decimals = defaults[symbol] || 4;
    return quantity.toFixed(decimals);
  }

  /**
   * Clear all caches including trading transaction cache
   */
  static clearCache(): void {
    this.instrumentCache.clear();
    BybitInstrumentService.clearCache();
    InstrumentCache.clearAllTradingCache();
    console.log('🧹 Cleared all ConfigurableFormatter and trading transaction caches');
  }

  /**
   * Clear all trading transaction cache data (comprehensive clear)
   */
  static clearAllTradingCache(): void {
    this.instrumentCache.clear();
    this.config = null;
    this.activePairs = [];
    BybitInstrumentService.clearCache();
    InstrumentCache.clearAllTradingCache();
    console.log('🧹 Cleared ALL trading transaction cache data from ConfigurableFormatter');
  }
}
