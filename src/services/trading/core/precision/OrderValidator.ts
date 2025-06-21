
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
      const basePrecision = parseFloat(instrumentInfo.basePrecision);
      const tickSize = parseFloat(instrumentInfo.tickSize);
      const orderValue = price * quantity;

      console.log(`🔍 Validating order for ${symbol}:`);
      console.log(`  - Quantity: ${quantity} (min: ${minOrderQty}, precision: ${basePrecision})`);
      console.log(`  - Price: ${price} (tick: ${tickSize})`);
      console.log(`  - Order value: ${orderValue} (min: ${minOrderAmt})`);

      if (quantity < minOrderQty) {
        console.error(`❌ Quantity ${quantity} below minimum ${minOrderQty} for ${symbol}`);
        return false;
      }

      if (orderValue < minOrderAmt) {
        console.error(`❌ Order value ${orderValue} below minimum ${minOrderAmt} for ${symbol}`);
        return false;
      }

      const quantityRemainder = Number(((quantity / basePrecision) % 1).toFixed(10));
      if (quantityRemainder > 0.0000000001) {
        console.error(`❌ Quantity ${quantity} is not a valid multiple of basePrecision ${basePrecision} for ${symbol} (remainder: ${quantityRemainder})`);
        return false;
      }

      const priceRemainder = Number(((price / tickSize) % 1).toFixed(10));
      if (priceRemainder > 0.0000000001) {
        console.error(`❌ Price ${price} is not a valid multiple of tickSize ${tickSize} for ${symbol} (remainder: ${priceRemainder})`);
        return false;
      }

      console.log(`✅ Order validation passed for ${symbol}`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Error validating order for ${symbol}, allowing with basic validation:`, error);
      
      // Basic fallback validation
      const orderValue = price * quantity;
      return quantity > 0 && orderValue > 10;
    }
  }
}
