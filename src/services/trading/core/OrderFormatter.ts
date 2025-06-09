
import { BybitInstrumentService } from './BybitInstrumentService';

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
    // Get instrument info for precise formatting
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (!instrumentInfo) {
      throw new Error(`Failed to get instrument info for ${symbol}`);
    }

    console.log(`📋 Using instrument info for ${symbol}:`, instrumentInfo);

    // CRITICAL: Use Bybit instrument info for ALL price and quantity formatting
    const formattedQuantity = BybitInstrumentService.formatQuantity(symbol, quantity, instrumentInfo);
    const formattedPrice = BybitInstrumentService.formatPrice(symbol, entryPrice, instrumentInfo);

    console.log(`  🔧 Formatted Quantity: ${formattedQuantity} (${instrumentInfo.quantityDecimals} decimals)`);
    console.log(`  🔧 Formatted Entry Price: ${formattedPrice} (${instrumentInfo.priceDecimals} decimals)`);

    // Validate the order meets Bybit requirements
    if (!BybitInstrumentService.validateOrder(symbol, parseFloat(formattedPrice), parseFloat(formattedQuantity), instrumentInfo)) {
      throw new Error(`Order validation failed for ${symbol}`);
    }

    return {
      quantity: formattedQuantity,
      price: formattedPrice,
      instrumentInfo
    };
  }

  static async formatSellOrder(
    symbol: string, 
    quantity: number, 
    price: number, 
    instrumentInfo: any
  ): Promise<FormattedOrderData> {
    const formattedPrice = BybitInstrumentService.formatPrice(symbol, price, instrumentInfo);
    const formattedQuantity = BybitInstrumentService.formatQuantity(symbol, quantity, instrumentInfo);
    
    console.log(`  🔧 Formatted Take-Profit Price: ${formattedPrice} (${instrumentInfo.priceDecimals} decimals)`);
    console.log(`  🔧 Formatted Quantity: ${formattedQuantity} (${instrumentInfo.quantityDecimals} decimals)`);
    
    // Validate the formatted take-profit order
    if (!BybitInstrumentService.validateOrder(symbol, parseFloat(formattedPrice), parseFloat(formattedQuantity), instrumentInfo)) {
      throw new Error(`Take-profit order validation failed for ${symbol}`);
    }

    return {
      quantity: formattedQuantity,
      price: formattedPrice,
      instrumentInfo
    };
  }
}
