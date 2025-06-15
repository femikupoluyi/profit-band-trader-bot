
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';

export class PriceFormatter {
  /**
   * Format price for a specific symbol using Bybit precision
   */
  static async formatPriceForSymbol(symbol: string, price: number): Promise<string> {
    return await BybitPrecisionFormatter.formatPrice(symbol, price);
  }

  /**
   * Format quantity for a specific symbol using Bybit precision
   */
  static async formatQuantityForSymbol(symbol: string, quantity: number): Promise<string> {
    return await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
  }

  /**
   * Get the minimum notional value for a symbol
   */
  static async getMinimumNotional(symbol: string): Promise<number> {
    const { BybitInstrumentService } = await import('./BybitInstrumentService');
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (instrumentInfo) {
      return parseFloat(instrumentInfo.minOrderAmt);
    }
    return 10; // Fallback minimum
  }

  /**
   * Get the quantity increment for a symbol
   */
  static async getQuantityIncrement(symbol: string): Promise<number> {
    const { BybitInstrumentService } = await import('./BybitInstrumentService');
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (instrumentInfo) {
      return parseFloat(instrumentInfo.basePrecision);
    }
    return 0.0001; // Fallback increment
  }

  /**
   * Validate if a price is properly formatted for a symbol
   */
  static async validatePrice(symbol: string, price: number): Promise<boolean> {
    return await BybitPrecisionFormatter.validateOrder(symbol, price, 1);
  }

  /**
   * Validate if a quantity is properly formatted for a symbol
   */
  static async validateQuantity(symbol: string, quantity: number): Promise<boolean> {
    try {
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      const parsedQuantity = parseFloat(formattedQuantity);
      
      // Check if the formatted quantity matches the original (within tolerance)
      const tolerance = 0.0001;
      return Math.abs(quantity - parsedQuantity) <= tolerance;
    } catch (error) {
      console.error(`Error validating quantity for ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Clear all cached data
   */
  static clearCache(): void {
    BybitPrecisionFormatter.clearCache();
  }
}
