
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';

export interface FormattedOrderData {
  quantity: string;
  price: string;
  instrumentInfo: any;
}

export class OrderFormatter {
  static async formatBuyOrder(
    symbol: string, 
    quantity: number, 
    entryPrice: number
  ): Promise<FormattedOrderData> {
    try {
      console.log(`📋 Formatting buy order for ${symbol}: qty=${quantity}, price=${entryPrice}`);

      // Clear any cached data first to ensure fresh precision
      BybitPrecisionFormatter.clearCache();

      // Use Bybit precision formatter for exact formatting
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, entryPrice);

      console.log(`🔧 Formatted values - Quantity: ${formattedQuantity}, Price: ${formattedPrice}`);

      // Validate the order meets Bybit requirements
      const isValid = await BybitPrecisionFormatter.validateOrder(symbol, parseFloat(formattedPrice), parseFloat(formattedQuantity));
      if (!isValid) {
        throw new Error(`Order validation failed for ${symbol}`);
      }

      // Get instrument info for reference
      const { BybitInstrumentService } = await import('./BybitInstrumentService');
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);

      return {
        quantity: formattedQuantity,
        price: formattedPrice,
        instrumentInfo
      };
    } catch (error) {
      console.error(`❌ Error formatting buy order for ${symbol}:`, error);
      throw error;
    }
  }

  static async formatSellOrder(
    symbol: string, 
    quantity: number, 
    price: number, 
    instrumentInfo: any
  ): Promise<FormattedOrderData> {
    try {
      console.log(`📋 Formatting sell order for ${symbol}: qty=${quantity}, price=${price}`);

      // Clear any cached data first to ensure fresh precision
      BybitPrecisionFormatter.clearCache();

      // Use Bybit precision formatter for exact formatting
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, price);
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      
      console.log(`🔧 Formatted values - Quantity: ${formattedQuantity}, Price: ${formattedPrice}`);
      
      // Validate the formatted sell order
      const isValid = await BybitPrecisionFormatter.validateOrder(symbol, parseFloat(formattedPrice), parseFloat(formattedQuantity));
      if (!isValid) {
        throw new Error(`Sell order validation failed for ${symbol}`);
      }

      return {
        quantity: formattedQuantity,
        price: formattedPrice,
        instrumentInfo
      };
    } catch (error) {
      console.error(`❌ Error formatting sell order for ${symbol}:`, error);
      throw error;
    }
  }
}
