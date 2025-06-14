
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
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
   * Format price using BybitInstrumentService ONLY
   */
  static async formatPrice(symbol: string, price: number): Promise<string> {
    try {
      if (typeof price !== 'number' || isNaN(price)) {
        console.error(`Invalid price value for ${symbol}:`, price);
        return '0.00';
      }

      // ALWAYS get instrument info from Bybit - no fallbacks
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (!instrumentInfo) {
        throw new Error(`Could not get instrument info for ${symbol}`);
      }

      return BybitInstrumentService.formatPrice(symbol, price, instrumentInfo);
    } catch (error) {
      console.error(`Error formatting price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Format quantity using BybitInstrumentService ONLY
   */
  static async formatQuantity(symbol: string, quantity: number): Promise<string> {
    try {
      if (typeof quantity !== 'number' || isNaN(quantity)) {
        console.error(`Invalid quantity value for ${symbol}:`, quantity);
        return '0.0000';
      }

      // ALWAYS get instrument info from Bybit - no fallbacks
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (!instrumentInfo) {
        throw new Error(`Could not get instrument info for ${symbol}`);
      }

      return BybitInstrumentService.formatQuantity(symbol, quantity, instrumentInfo);
    } catch (error) {
      console.error(`Error formatting quantity for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Synchronous version using cached instrument info
   */
  static formatPriceSync(symbol: string, price: number): string {
    try {
      const cached = this.instrumentCache.get(symbol);
      if (!cached) {
        throw new Error(`No cached instrument info for ${symbol} - use async version`);
      }
      return BybitInstrumentService.formatPrice(symbol, price, cached);
    } catch (error) {
      console.error(`Error in sync price formatting for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Synchronous version using cached instrument info
   */
  static formatQuantitySync(symbol: string, quantity: number): string {
    try {
      const cached = this.instrumentCache.get(symbol);
      if (!cached) {
        throw new Error(`No cached instrument info for ${symbol} - use async version`);
      }
      return BybitInstrumentService.formatQuantity(symbol, quantity, cached);
    } catch (error) {
      console.error(`Error in sync quantity formatting for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Validate order using Bybit instrument requirements ONLY
   */
  static async validateOrder(symbol: string, price: number, quantity: number): Promise<boolean> {
    try {
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (!instrumentInfo) {
        throw new Error(`Could not get instrument info for ${symbol}`);
      }

      return BybitInstrumentService.validateOrder(symbol, price, quantity, instrumentInfo);
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
      this.instrumentCache.clear(); // Clear old cache first
      for (const [symbol, info] of instrumentMap) {
        this.instrumentCache.set(symbol, info);
      }
      
      console.log(`✅ Preloaded instrument info for ${instrumentMap.size} symbols`);
    } catch (error) {
      console.error('Error preloading instrument info:', error);
      throw error;
    }
  }

  /**
   * Clear all caches
   */
  static clearCache(): void {
    this.instrumentCache.clear();
    BybitInstrumentService.clearCache();
    console.log('🧹 Cleared all ConfigurableFormatter caches');
  }

  /**
   * Clear all trading transaction cache data
   */
  static clearAllTradingCache(): void {
    this.instrumentCache.clear();
    this.config = null;
    this.activePairs = [];
    BybitInstrumentService.clearCache();
    console.log('🧹 Cleared ALL trading cache data from ConfigurableFormatter');
  }
}
