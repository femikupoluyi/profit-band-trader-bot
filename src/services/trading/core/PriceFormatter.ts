
import { BybitInstrumentService } from './BybitInstrumentService';

export class PriceFormatter {
  /**
   * Format price for a specific symbol - ALWAYS uses BybitInstrumentService
   */
  static async formatPriceForSymbol(symbol: string, price: number): Promise<string> {
    // Always use BybitInstrumentService for accurate formatting
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (!instrumentInfo) {
      throw new Error(`Could not get instrument info for ${symbol}`);
    }
    return BybitInstrumentService.formatPrice(symbol, price, instrumentInfo);
  }

  /**
   * Format quantity for a specific symbol - ALWAYS uses BybitInstrumentService
   */
  static async formatQuantityForSymbol(symbol: string, quantity: number): Promise<string> {
    // Always use BybitInstrumentService for accurate formatting
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (!instrumentInfo) {
      throw new Error(`Could not get instrument info for ${symbol}`);
    }
    return BybitInstrumentService.formatQuantity(symbol, quantity, instrumentInfo);
  }

  /**
   * Get the minimum notional value for a symbol
   */
  static async getMinimumNotional(symbol: string): Promise<number> {
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
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (!instrumentInfo) {
      return false;
    }
    return BybitInstrumentService.validateOrder(symbol, price, 1, instrumentInfo);
  }

  /**
   * Validate if a quantity is properly formatted for a symbol
   */
  static async validateQuantity(symbol: string, quantity: number): Promise<boolean> {
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (!instrumentInfo) {
      return false;
    }
    
    const basePrecision = parseFloat(instrumentInfo.basePrecision);
    const remainder = quantity % basePrecision;
    const tolerance = basePrecision / 1000;
    
    return remainder <= tolerance || (basePrecision - remainder) <= tolerance;
  }

  /**
   * Clear all cached data
   */
  static clearCache(): void {
    BybitInstrumentService.clearCache();
  }
}
