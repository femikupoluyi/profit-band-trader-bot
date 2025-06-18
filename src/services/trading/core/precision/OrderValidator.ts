
import { BybitInstrumentService } from '../BybitInstrumentService';

export class OrderValidator {
  static async validateOrder(symbol: string, price: number, quantity: number): Promise<boolean> {
    try {
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (!instrumentInfo) {
        console.error(`❌ Could not get instrument info for ${symbol}`);
        return false;
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
      console.error(`❌ Error validating order for ${symbol}:`, error);
      return false;
    }
  }
}
