import { getSupportedTradingPairs } from '@/components/trading/test/testConstants';
import { BybitInstrumentService } from './BybitInstrumentService';

export class PriceFormatter {
  // Legacy symbol-specific precision mapping - now deprecated in favor of BybitInstrumentService
  private static readonly SYMBOL_PRECISION: Record<string, { price: number; quantity: number }> = {
    'BTCUSDT': { price: 2, quantity: 5 },
    'ETHUSDT': { price: 2, quantity: 4 },
    'SOLUSDT': { price: 4, quantity: 2 },
    'BNBUSDT': { price: 2, quantity: 3 },
    'ADAUSDT': { price: 6, quantity: 0 },
    'XRPUSDT': { price: 6, quantity: 1 },
    'LTCUSDT': { price: 2, quantity: 2 },
    'POLUSDT': { price: 4, quantity: 0 },
    'FETUSDT': { price: 6, quantity: 0 },
    'XLMUSDT': { price: 3, quantity: 0 },
    'DOGEUSDT': { price: 6, quantity: 0 },
    'MATICUSDT': { price: 6, quantity: 0 }
  };

  private static readonly DEFAULT_PRECISION = { price: 4, quantity: 4 };

  /**
   * Format price for a specific symbol - now uses BybitInstrumentService when possible
   */
  static async formatPriceForSymbol(symbol: string, price: number): Promise<string> {
    // Use BybitInstrumentService for accurate formatting
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (instrumentInfo) {
      return BybitInstrumentService.formatPrice(symbol, price, instrumentInfo);
    }
    
    // Fallback to legacy precision
    const precision = this.SYMBOL_PRECISION[symbol] || this.DEFAULT_PRECISION;
    return price.toFixed(precision.price);
  }

  /**
   * Format quantity for a specific symbol - now uses BybitInstrumentService when possible
   */
  static async formatQuantityForSymbol(symbol: string, quantity: number): Promise<string> {
    // Use BybitInstrumentService for accurate formatting
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (instrumentInfo) {
      return BybitInstrumentService.formatQuantity(symbol, quantity, instrumentInfo);
    }
    
    // Fallback to legacy precision
    const precision = this.SYMBOL_PRECISION[symbol] || this.DEFAULT_PRECISION;
    return quantity.toFixed(precision.quantity);
  }

  /**
   * Get the minimum notional value for a symbol
   */
  static getMinimumNotional(symbol: string): number {
    // Dynamic minimum notional values based on symbol
    const minimumNotionals: Record<string, number> = {};
    
    // Initialize with supported symbols
    getSupportedTradingPairs().forEach(pair => {
      minimumNotionals[pair] = 10; // Default minimum
    });
    
    // Override specific values
    const specificMinimums = {
      'BTCUSDT': 10, 'ETHUSDT': 10, 'SOLUSDT': 10, 'BNBUSDT': 10,
      'ADAUSDT': 10, 'XRPUSDT': 10, 'LTCUSDT': 10, 'POLUSDT': 10,
      'FETUSDT': 10, 'XLMUSDT': 10, 'DOGEUSDT': 10, 'MATICUSDT': 10
    };
    
    return specificMinimums[symbol] || minimumNotionals[symbol] || 10;
  }

  /**
   * Get the quantity increment for a symbol
   */
  static getQuantityIncrement(symbol: string): number {
    const increments: Record<string, number> = {
      'BTCUSDT': 0.00001, 'ETHUSDT': 0.0001, 'SOLUSDT': 0.01, 'BNBUSDT': 0.001,
      'ADAUSDT': 1, 'XRPUSDT': 0.1, 'LTCUSDT': 0.01, 'POLUSDT': 1,
      'FETUSDT': 1, 'XLMUSDT': 1, 'DOGEUSDT': 1, 'MATICUSDT': 1
    };

    return increments[symbol] || 0.0001;
  }

  /**
   * Validate if a price is properly formatted for a symbol
   */
  static validatePrice(symbol: string, price: number): boolean {
    const precision = this.SYMBOL_PRECISION[symbol] || this.DEFAULT_PRECISION;
    const formattedPrice = parseFloat(price.toFixed(precision.price));
    return Math.abs(price - formattedPrice) < Number.EPSILON;
  }

  /**
   * Validate if a quantity is properly formatted for a symbol
   */
  static validateQuantity(symbol: string, quantity: number): boolean {
    const precision = this.SYMBOL_PRECISION[symbol] || this.DEFAULT_PRECISION;
    const formattedQuantity = parseFloat(quantity.toFixed(precision.quantity));
    return Math.abs(quantity - formattedQuantity) < Number.EPSILON;
  }

  /**
   * Get all supported symbols with their precision settings
   */
  static getSupportedSymbolsWithPrecision(): Record<string, { price: number; quantity: number }> {
    const supported: Record<string, { price: number; quantity: number }> = {};
    
    getSupportedTradingPairs().forEach(symbol => {
      supported[symbol] = this.SYMBOL_PRECISION[symbol] || this.DEFAULT_PRECISION;
    });
    
    return supported;
  }

  /**
   * Update precision for a symbol dynamically
   */
  static updateSymbolPrecision(symbol: string, pricePrecision: number, quantityPrecision: number): void {
    this.SYMBOL_PRECISION[symbol] = {
      price: pricePrecision,
      quantity: quantityPrecision
    };
  }
}
