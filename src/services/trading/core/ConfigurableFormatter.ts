
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';
import { BybitInstrumentService, BybitInstrumentInfo } from './BybitInstrumentService';

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
   * Format price using BybitPrecisionFormatter ONLY - DELEGATES for consistency
   */
  static async formatPrice(symbol: string, price: number): Promise<string> {
    try {
      console.log(`📋 ConfigurableFormatter: Delegating price formatting to BybitPrecisionFormatter for ${symbol}`);
      
      if (typeof price !== 'number' || isNaN(price)) {
        console.error(`ConfigurableFormatter: Invalid price value for ${symbol}:`, price);
        return '0.00';
      }

      // ALWAYS delegate to BybitPrecisionFormatter for consistency
      return await BybitPrecisionFormatter.formatPrice(symbol, price);
    } catch (error) {
      console.error(`ConfigurableFormatter error formatting price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Format quantity using BybitPrecisionFormatter ONLY - DELEGATES for consistency
   */
  static async formatQuantity(symbol: string, quantity: number): Promise<string> {
    try {
      console.log(`📋 ConfigurableFormatter: Delegating quantity formatting to BybitPrecisionFormatter for ${symbol}`);
      
      if (typeof quantity !== 'number' || isNaN(quantity)) {
        console.error(`ConfigurableFormatter: Invalid quantity value for ${symbol}:`, quantity);
        return '0.0000';
      }

      // ALWAYS delegate to BybitPrecisionFormatter for consistency
      return await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
    } catch (error) {
      console.error(`ConfigurableFormatter error formatting quantity for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Synchronous version using cached instrument info - DEPRECATED, use async version
   */
  static formatPriceSync(symbol: string, price: number): string {
    console.warn(`ConfigurableFormatter: formatPriceSync is deprecated, use async formatPrice instead for ${symbol}`);
    try {
      const cached = this.instrumentCache.get(symbol);
      if (!cached) {
        throw new Error(`No cached instrument info for ${symbol} - use async version`);
      }
      return BybitInstrumentService.formatPrice(symbol, price, cached);
    } catch (error) {
      console.error(`ConfigurableFormatter error in sync price formatting for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Synchronous version using cached instrument info - DEPRECATED, use async version
   */
  static formatQuantitySync(symbol: string, quantity: number): string {
    console.warn(`ConfigurableFormatter: formatQuantitySync is deprecated, use async formatQuantity instead for ${symbol}`);
    try {
      const cached = this.instrumentCache.get(symbol);
      if (!cached) {
        throw new Error(`No cached instrument info for ${symbol} - use async version`);
      }
      return BybitInstrumentService.formatQuantity(symbol, quantity, cached);
    } catch (error) {
      console.error(`ConfigurableFormatter error in sync quantity formatting for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Validate order using BybitPrecisionFormatter ONLY - DELEGATES for consistency
   */
  static async validateOrder(symbol: string, price: number, quantity: number): Promise<boolean> {
    try {
      console.log(`📋 ConfigurableFormatter: Delegating order validation to BybitPrecisionFormatter for ${symbol}`);
      return await BybitPrecisionFormatter.validateOrder(symbol, price, quantity);
    } catch (error) {
      console.error(`ConfigurableFormatter error validating order for ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Pre-cache instrument info for active trading pairs
   */
  static async preloadInstrumentInfo(symbols: string[]): Promise<void> {
    try {
      console.log(`🔄 ConfigurableFormatter: Preloading instrument info for ${symbols.length} symbols...`);
      const instrumentMap = await BybitInstrumentService.getMultipleInstrumentInfo(symbols);
      
      // Cache the results locally
      this.instrumentCache.clear(); // Clear old cache first
      for (const [symbol, info] of instrumentMap) {
        this.instrumentCache.set(symbol, info);
      }
      
      console.log(`✅ ConfigurableFormatter: Preloaded instrument info for ${instrumentMap.size} symbols`);
    } catch (error) {
      console.error('ConfigurableFormatter error preloading instrument info:', error);
      throw error;
    }
  }

  /**
   * Clear all caches - DELEGATES to BybitPrecisionFormatter
   */
  static clearCache(): void {
    console.log(`🧹 ConfigurableFormatter: Delegating cache clear to BybitPrecisionFormatter`);
    this.instrumentCache.clear();
    BybitPrecisionFormatter.clearCache();
  }

  /**
   * Clear all trading transaction cache data
   */
  static clearAllTradingCache(): void {
    console.log(`🧹 ConfigurableFormatter: Clearing ALL trading cache data`);
    this.instrumentCache.clear();
    this.config = null;
    this.activePairs = [];
    BybitPrecisionFormatter.clearCache();
  }
}
