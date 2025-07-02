
import { BybitInstrumentService } from '../BybitInstrumentService';

export class OrderValidator {
  static async validateOrder(symbol: string, price: number, quantity: number): Promise<boolean> {
    try {
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (!instrumentInfo) {
        console.warn(`⚠️ No instrument info for ${symbol}, using basic validation`);
        
        // Basic fallback validation
        const orderValue = price * quantity;
        const minValue = 10; // Default minimum
        
        if (quantity <= 0) {
          console.error(`❌ Invalid quantity ${quantity} for ${symbol}`);
          return false;
        }
        
        if (orderValue < minValue) {
          console.error(`❌ Order value ${orderValue} below minimum ${minValue} for ${symbol}`);
          return false;
        }
        
        console.log(`✅ Order validation passed for ${symbol} (fallback validation)`);
        return true;
      }

      const minOrderQty = parseFloat(instrumentInfo.minOrderQty);
      const minOrderAmt = parseFloat(instrumentInfo.minOrderAmt);
      const orderValue = price * quantity;

      console.log(`🔍 Validating order for ${symbol}:`);
      console.log(`  - Quantity: ${quantity} (min: ${minOrderQty})`);
      console.log(`  - Price: ${price}`);
      console.log(`  - Order value: ${orderValue} (min: ${minOrderAmt})`);

      // Use minimum order requirements from API - these are the actual Bybit requirements
      if (quantity < minOrderQty) {
        console.error(`❌ Quantity ${quantity} below minimum ${minOrderQty} for ${symbol}`);
        return false;
      }

      if (orderValue < minOrderAmt) {
        console.error(`❌ Order value ${orderValue} below minimum ${minOrderAmt} for ${symbol}`);
        return false;
      }

      // FIXED: Use the exact precision formatters instead of floating-point arithmetic
      // Format the values using API-derived precision and then validate they match
      const formattedPrice = price.toFixed(instrumentInfo.priceDecimals);
      const formattedQuantity = quantity.toFixed(instrumentInfo.quantityDecimals);
      
      const parsedPrice = parseFloat(formattedPrice);
      const parsedQuantity = parseFloat(formattedQuantity);
      
      // Check if the formatted values are close enough to the original (tolerance for precision)
      const priceTolerance = 0.000001;
      const quantityTolerance = 0.000001;
      
      if (Math.abs(price - parsedPrice) > priceTolerance) {
        console.error(`❌ Price ${price} cannot be properly formatted for ${symbol} (formatted: ${formattedPrice})`);
        return false;
      }
      
      if (Math.abs(quantity - parsedQuantity) > quantityTolerance) {
        console.error(`❌ Quantity ${quantity} cannot be properly formatted for ${symbol} (formatted: ${formattedQuantity})`);
        return false;
      }

      console.log(`✅ Order validation passed for ${symbol} using API-derived precision`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Error validating order for ${symbol}, allowing with basic validation:`, error);
      
      // Basic fallback validation
      const orderValue = price * quantity;
      return quantity > 0 && orderValue > 10;
    }
  }
}
