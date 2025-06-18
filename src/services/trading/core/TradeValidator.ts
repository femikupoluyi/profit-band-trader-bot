
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';
import { TypeConverter } from './TypeConverter';

export class TradeValidator {
  static async validateTradeParameters(symbol: string, quantity: number, entryPrice: number, config: TradingConfigData): Promise<boolean> {
    console.log(`🔍 TradeValidator: Validating trade parameters for ${symbol}`);
    
    try {
      // Validate and convert types first
      const validatedPrice = TypeConverter.toPrice(entryPrice, 'entryPrice');
      const validatedQuantity = TypeConverter.toQuantity(quantity, 'quantity');

      console.log(`🔧 TradeValidator type validation passed: price=${validatedPrice}, quantity=${validatedQuantity}`);

      // CRITICAL: Use ONLY BybitPrecisionFormatter for consistency
      BybitPrecisionFormatter.clearCache();
      
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, validatedPrice);
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, validatedQuantity);
      
      const finalPrice = parseFloat(formattedPrice);
      const finalQuantity = parseFloat(formattedQuantity);

      console.log(`🔧 TradeValidator formatted values: price="${formattedPrice}" (${finalPrice}), quantity="${formattedQuantity}" (${finalQuantity})`);

      // Validate using BybitPrecisionFormatter requirements
      const isValidOrder = await BybitPrecisionFormatter.validateOrder(symbol, finalPrice, finalQuantity);
      if (!isValidOrder) {
        console.error(`❌ TradeValidator: Order validation failed for ${symbol}`);
        return false;
      }

      const orderValue = finalQuantity * finalPrice;
      
      // Validate against maximum order amount from config with type conversion
      const maxOrderAmount = TypeConverter.toNumberSafe(config.max_order_amount_usd, 100);
      if (orderValue > maxOrderAmount) {
        console.log(`❌ TradeValidator: Order value ${orderValue.toFixed(2)} exceeds maximum ${maxOrderAmount}`);
        return false;
      }

      console.log(`✅ TradeValidator: Trade parameters valid for ${symbol}: $${orderValue.toFixed(2)}`);
      return true;
    } catch (error) {
      console.error(`❌ TradeValidator: Type validation failed for ${symbol}:`, error);
      return false;
    }
  }

  static async calculateQuantity(symbol: string, orderAmount: number, entryPrice: number, config: TradingConfigData): Promise<number> {
    try {
      console.log(`🧮 TradeValidator: Calculating quantity for ${symbol}`);
      
      // Validate input types first
      const validatedOrderAmount = TypeConverter.toNumberSafe(orderAmount, 100);
      const validatedEntryPrice = TypeConverter.toPrice(entryPrice, 'entryPrice');
      
      // CRITICAL: Use ONLY BybitPrecisionFormatter for accurate calculation
      BybitPrecisionFormatter.clearCache();
      const quantity = await BybitPrecisionFormatter.calculateQuantity(symbol, validatedOrderAmount, validatedEntryPrice);
      
      console.log(`📊 TradeValidator quantity calculation for ${symbol}:`, {
        orderAmount: validatedOrderAmount.toFixed(2),
        entryPrice: await BybitPrecisionFormatter.formatPrice(symbol, validatedEntryPrice),
        calculatedQuantity: await BybitPrecisionFormatter.formatQuantity(symbol, quantity)
      });
      
      return quantity;
    } catch (error) {
      console.error(`❌ TradeValidator error calculating quantity for ${symbol}:`, error);
      throw error;
    }
  }

  static async validateQuantityPrecision(symbol: string, quantity: number): Promise<boolean> {
    try {
      console.log(`🔍 TradeValidator: Validating quantity precision for ${symbol}`);
      
      // Validate type first
      const validatedQuantity = TypeConverter.toQuantity(quantity, 'quantity');
      
      // CRITICAL: Use ONLY BybitPrecisionFormatter
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, validatedQuantity);
      const parsedQuantity = parseFloat(formattedQuantity);
      
      // Check if the formatted quantity matches the original (within tolerance)
      const tolerance = 0.0001;
      const isValid = Math.abs(validatedQuantity - parsedQuantity) <= tolerance;
      
      console.log(`📊 TradeValidator precision check: original=${validatedQuantity}, formatted="${formattedQuantity}", parsed=${parsedQuantity}, valid=${isValid}`);
      
      return isValid;
    } catch (error) {
      console.error(`❌ TradeValidator error validating quantity precision for ${symbol}:`, error);
      return false;
    }
  }

  static validatePriceRange(currentPrice: number, entryPrice: number, maxDeviationPercent: number = 5): boolean {
    try {
      // Validate types first
      const validatedCurrentPrice = TypeConverter.toPrice(currentPrice, 'currentPrice');
      const validatedEntryPrice = TypeConverter.toPrice(entryPrice, 'entryPrice');
      
      const deviation = Math.abs((validatedEntryPrice - validatedCurrentPrice) / validatedCurrentPrice) * 100;
      
      if (deviation > maxDeviationPercent) {
        console.error(`❌ TradeValidator: Entry price deviation too high: ${deviation.toFixed(2)}% (max: ${maxDeviationPercent}%)`);
        return false;
      }
      
      console.log(`✅ TradeValidator: Price range validation passed: ${deviation.toFixed(2)}% deviation`);
      return true;
    } catch (error) {
      console.error(`❌ TradeValidator: Price range validation failed:`, error);
      return false;
    }
  }
}
