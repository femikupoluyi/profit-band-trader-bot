
import { BybitInstrumentService } from './BybitInstrumentService';

export class BybitPrecisionFormatter {
  private static instrumentCache = new Map<string, any>();

  /**
   * Format price using Bybit's exact tick size precision
   */
  static async formatPrice(symbol: string, price: number): Promise<string> {
    try {
      const instrumentInfo = await this.getInstrumentInfo(symbol);
      const tickSize = parseFloat(instrumentInfo.tickSize);
      
      // Round to nearest tick size
      const roundedPrice = Math.round(price / tickSize) * tickSize;
      
      // Format with correct decimal places
      return roundedPrice.toFixed(instrumentInfo.priceDecimals);
    } catch (error) {
      console.error(`Error formatting price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Format quantity using Bybit's exact base precision
   */
  static async formatQuantity(symbol: string, quantity: number): Promise<string> {
    try {
      const instrumentInfo = await this.getInstrumentInfo(symbol);
      const basePrecision = parseFloat(instrumentInfo.basePrecision);
      
      // Round down to nearest base precision increment
      const roundedQuantity = Math.floor(quantity / basePrecision) * basePrecision;
      
      // Format with correct decimal places
      return roundedQuantity.toFixed(instrumentInfo.quantityDecimals);
    } catch (error) {
      console.error(`Error formatting quantity for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Validate order meets Bybit minimum requirements
   */
  static async validateOrder(symbol: string, price: number, quantity: number): Promise<boolean> {
    try {
      const instrumentInfo = await this.getInstrumentInfo(symbol);
      
      const minOrderQty = parseFloat(instrumentInfo.minOrderQty);
      const minOrderAmt = parseFloat(instrumentInfo.minOrderAmt);
      const orderValue = price * quantity;

      if (quantity < minOrderQty) {
        console.error(`❌ Quantity ${quantity} below minimum ${minOrderQty} for ${symbol}`);
        return false;
      }

      if (orderValue < minOrderAmt) {
        console.error(`❌ Order value ${orderValue} below minimum ${minOrderAmt} for ${symbol}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error validating order for ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Calculate proper quantity for order amount using Bybit precision
   */
  static async calculateQuantity(symbol: string, orderAmount: number, price: number): Promise<number> {
    try {
      const instrumentInfo = await this.getInstrumentInfo(symbol);
      const basePrecision = parseFloat(instrumentInfo.basePrecision);
      
      // Calculate raw quantity
      const rawQuantity = orderAmount / price;
      
      // Round down to nearest base precision increment
      const adjustedQuantity = Math.floor(rawQuantity / basePrecision) * basePrecision;
      
      return adjustedQuantity;
    } catch (error) {
      console.error(`Error calculating quantity for ${symbol}:`, error);
      throw error;
    }
  }

  private static async getInstrumentInfo(symbol: string): Promise<any> {
    // Check cache first
    if (this.instrumentCache.has(symbol)) {
      return this.instrumentCache.get(symbol);
    }

    // Fetch from Bybit
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (!instrumentInfo) {
      throw new Error(`Could not get instrument info for ${symbol}`);
    }

    // Cache it
    this.instrumentCache.set(symbol, instrumentInfo);
    return instrumentInfo;
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.instrumentCache.clear();
  }
}
