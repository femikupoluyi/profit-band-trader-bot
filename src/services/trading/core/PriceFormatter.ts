
export class PriceFormatter {
  // Symbol-specific precision mapping for common trading pairs
  private static readonly SYMBOL_PRECISION: Record<string, { price: number; quantity: number }> = {
    'BTCUSDT': { price: 2, quantity: 5 },
    'ETHUSDT': { price: 2, quantity: 4 },
    'SOLUSDT': { price: 4, quantity: 2 },
    'BNBUSDT': { price: 2, quantity: 3 },
    'ADAUSDT': { price: 6, quantity: 0 },
    'XRPUSDT': { price: 6, quantity: 1 },
    'LTCUSDT': { price: 2, quantity: 2 },
    'POLUSDT': { price: 4, quantity: 0 }, // Updated to 4 decimals for price
    'FETUSDT': { price: 6, quantity: 0 },
    'XLMUSDT': { price: 4, quantity: 0 } // Updated to 4 decimals for price
  };

  // Default precision for unknown symbols
  private static readonly DEFAULT_PRECISION = { price: 4, quantity: 4 };

  /**
   * Format price for a specific symbol with correct decimal places
   */
  static formatPriceForSymbol(symbol: string, price: number): string {
    const precision = this.SYMBOL_PRECISION[symbol] || this.DEFAULT_PRECISION;
    return price.toFixed(precision.price);
  }

  /**
   * Format quantity for a specific symbol with correct decimal places
   */
  static formatQuantityForSymbol(symbol: string, quantity: number): string {
    const precision = this.SYMBOL_PRECISION[symbol] || this.DEFAULT_PRECISION;
    return quantity.toFixed(precision.quantity);
  }

  /**
   * Get the minimum notional value for a symbol
   */
  static getMinimumNotional(symbol: string): number {
    // Default minimum notional values
    const minimumNotionals: Record<string, number> = {
      'BTCUSDT': 10,
      'ETHUSDT': 10,
      'SOLUSDT': 10,
      'BNBUSDT': 10,
      'ADAUSDT': 10,
      'XRPUSDT': 10,
      'LTCUSDT': 10,
      'POLUSDT': 10,
      'FETUSDT': 10,
      'XLMUSDT': 10
    };

    return minimumNotionals[symbol] || 10;
  }

  /**
   * Get the quantity increment for a symbol
   */
  static getQuantityIncrement(symbol: string): number {
    const increments: Record<string, number> = {
      'BTCUSDT': 0.00001,
      'ETHUSDT': 0.0001,
      'SOLUSDT': 0.01,
      'BNBUSDT': 0.001,
      'ADAUSDT': 1,
      'XRPUSDT': 0.1,
      'LTCUSDT': 0.01,
      'POLUSDT': 1,
      'FETUSDT': 1,
      'XLMUSDT': 1
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
}
