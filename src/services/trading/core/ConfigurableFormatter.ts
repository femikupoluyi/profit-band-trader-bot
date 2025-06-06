
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class ConfigurableFormatter {
  private static config: TradingConfigData | null = null;

  static setConfig(config: TradingConfigData): void {
    this.config = config;
  }

  /**
   * Format price using config-specified decimal places or fallback to defaults
   */
  static formatPrice(symbol: string, price: number): string {
    if (!this.config) {
      throw new Error('ConfigurableFormatter not initialized with config');
    }

    // Check if custom price decimals are configured
    const customDecimals = this.config.price_decimals_per_symbol?.[symbol];
    if (customDecimals !== undefined) {
      return price.toFixed(customDecimals);
    }

    // Fallback to hardcoded defaults
    const defaults: Record<string, number> = {
      'BTCUSDT': 2, 'ETHUSDT': 2, 'BNBUSDT': 2, 'LTCUSDT': 2,
      'SOLUSDT': 4, 'ADAUSDT': 6, 'XRPUSDT': 6, 'DOGEUSDT': 6,
      'MATICUSDT': 6, 'FETUSDT': 6, 'POLUSDT': 4, 'XLMUSDT': 3
    };

    const decimals = defaults[symbol] || 4;
    return price.toFixed(decimals);
  }

  /**
   * Format quantity using config-specified decimal places or fallback to defaults
   */
  static formatQuantity(symbol: string, quantity: number): string {
    if (!this.config) {
      throw new Error('ConfigurableFormatter not initialized with config');
    }

    // Check if custom quantity decimals are configured
    const customDecimals = this.config.quantity_decimals_per_symbol?.[symbol];
    if (customDecimals !== undefined) {
      return quantity.toFixed(customDecimals);
    }

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
