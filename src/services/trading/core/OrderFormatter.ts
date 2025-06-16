
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
      console.log(`📋 OrderFormatter: Formatting buy order for ${symbol}: qty=${quantity}, price=${entryPrice}`);

      // CRITICAL: Use ONLY BybitPrecisionFormatter - clear cache first
      BybitPrecisionFormatter.clearCache();

      // Use BybitPrecisionFormatter for exact formatting - ensure strings are returned
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, entryPrice);

      console.log(`🔧 OrderFormatter formatted values - Quantity: "${formattedQuantity}", Price: "${formattedPrice}"`);

      // Validate the order meets Bybit requirements using the formatted values
      const isValid = await BybitPrecisionFormatter.validateOrder(symbol, parseFloat(formattedPrice), parseFloat(formattedQuantity));
      if (!isValid) {
        throw new Error(`OrderFormatter validation failed for ${symbol} - qty: ${formattedQuantity}, price: ${formattedPrice}`);
      }

      // Get instrument info for reference (using the same service as BybitPrecisionFormatter)
      const { BybitInstrumentService } = await import('./BybitInstrumentService');
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);

      return {
        quantity: formattedQuantity,
        price: formattedPrice,
        instrumentInfo
      };
    } catch (error) {
      console.error(`❌ OrderFormatter error formatting buy order for ${symbol}:`, error);
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
      console.log(`📋 OrderFormatter: Formatting sell order for ${symbol}: qty=${quantity}, price=${price}`);

      // CRITICAL: Use ONLY BybitPrecisionFormatter - clear cache first
      BybitPrecisionFormatter.clearCache();

      // Use BybitPrecisionFormatter for exact formatting - ensure strings are returned
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, price);
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      
      console.log(`🔧 OrderFormatter formatted values - Quantity: "${formattedQuantity}", Price: "${formattedPrice}"`);
      
      // Validate the formatted sell order using the formatted values
      const isValid = await BybitPrecisionFormatter.validateOrder(symbol, parseFloat(formattedPrice), parseFloat(formattedQuantity));
      if (!isValid) {
        throw new Error(`OrderFormatter sell validation failed for ${symbol} - qty: ${formattedQuantity}, price: ${formattedPrice}`);
      }

      return {
        quantity: formattedQuantity,
        price: formattedPrice,
        instrumentInfo
      };
    } catch (error) {
      console.error(`❌ OrderFormatter error formatting sell order for ${symbol}:`, error);
      throw error;
    }
  }
}
