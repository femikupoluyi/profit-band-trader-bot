
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class ConfigurableFormatter {
  private static config: TradingConfigData | null = null;
  private static activePairs: string[] = [];

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
   * Format price using config-specified decimal places or fallback to defaults
   */
  static formatPrice(symbol: string, price: number): string {
    try {
      if (!this.config) {
        console.warn('ConfigurableFormatter not initialized with config, using defaults');
        return this.formatPriceWithDefaults(symbol, price);
      }

      if (typeof price !== 'number' || isNaN(price)) {
        console.error(`Invalid price value for ${symbol}:`, price);
        return '0.00';
      }

      // Check if custom price decimals are configured
      const customDecimals = this.config.price_decimals_per_symbol?.[symbol];
      if (customDecimals !== undefined && typeof customDecimals === 'number') {
        return price.toFixed(Math.max(0, Math.min(8, customDecimals)));
      }

      return this.formatPriceWithDefaults(symbol, price);
    } catch (error) {
      console.error(`Error formatting price for ${symbol}:`, error);
      return this.formatPriceWithDefaults(symbol, price);
    }
  }

  /**
   * Format quantity using config-specified decimal places or fallback to defaults
   */
  static formatQuantity(symbol: string, quantity: number): string {
    try {
      if (!this.config) {
        console.warn('ConfigurableFormatter not initialized with config, using defaults');
        return this.formatQuantityWithDefaults(symbol, quantity);
      }

      if (typeof quantity !== 'number' || isNaN(quantity)) {
        console.error(`Invalid quantity value for ${symbol}:`, quantity);
        return '0.0000';
      }

      // Check if custom quantity decimals are configured
      const customDecimals = this.config.quantity_decimals_per_symbol?.[symbol];
      if (customDecimals !== undefined && typeof customDecimals === 'number') {
        return quantity.toFixed(Math.max(0, Math.min(8, customDecimals)));
      }

      return this.formatQuantityWithDefaults(symbol, quantity);
    } catch (error) {
      console.error(`Error formatting quantity for ${symbol}:`, error);
      return this.formatQuantityWithDefaults(symbol, quantity);
    }
  }

  private static formatPriceWithDefaults(symbol: string, price: number): string {
    // Fallback to hardcoded defaults
    const defaults: Record<string, number> = {
      'BTCUSDT': 2, 'ETHUSDT': 2, 'BNBUSDT': 2, 'LTCUSDT': 2,
      'SOLUSDT': 4, 'ADAUSDT': 6, 'XRPUSDT': 6, 'DOGEUSDT': 6,
      'MATICUSDT': 6, 'FETUSDT': 6, 'POLUSDT': 4, 'XLMUSDT': 3
    };

    const decimals = defaults[symbol] || 4;
    return price.toFixed(decimals);
  }

  private static formatQuantityWithDefaults(symbol: string, quantity: number): string {
    // Fallback to hardcoded defaults
    const defaults: Record<string, number> = {
      'BTCUSDT': 5, 'ETHUSDT': 4, 'SOLUSDT': 2, 'BNBUSDT': 3,
      'ADAUSDT': 0, 'XRPUSDT': 1, 'LTCUSDT': 2, 'POLUSDT': 0,
      'FETUSDT': 0, 'XLMUSDT': 0, 'DOGEUSDT': 0, 'MATICUSDT': 0
    };

    const decimals = defaults[symbol] || 4;
    return quantity.toFixed(decimals);
  }

  /**
   * Validate if the formatted values meet Bybit requirements
   */
  static validateFormatting(symbol: string, price: number, quantity: number): boolean {
    try {
      if (!symbol || typeof symbol !== 'string') {
        console.error('Invalid symbol provided for formatting validation');
        return false;
      }

      const formattedPrice = this.formatPrice(symbol, price);
      const formattedQuantity = this.formatQuantity(symbol, quantity);
      
      // Check if values can be parsed back correctly
      const parsedPrice = parseFloat(formattedPrice);
      const parsedQuantity = parseFloat(formattedQuantity);
      
      return !isNaN(parsedPrice) && !isNaN(parsedQuantity) && 
             parsedPrice > 0 && parsedQuantity > 0;
    } catch (error) {
      console.error(`Formatting validation failed for ${symbol}:`, error);
      return false;
    }
  }
}
