
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';

export class TradeValidator {
  static async validateTradeParameters(symbol: string, quantity: number, entryPrice: number, config: TradingConfigData): Promise<boolean> {
    console.log(`🔍 TradeValidator: Validating trade parameters for ${symbol}`);
    
    // Validate basic parameters
    if (isNaN(entryPrice) || isNaN(quantity) || quantity <= 0 || entryPrice <= 0) {
      console.error(`❌ TradeValidator: Invalid calculation results: entryPrice=${entryPrice}, quantity=${quantity}`);
      return false;
    }

    // CRITICAL: Use ONLY BybitPrecisionFormatter for consistency
    BybitPrecisionFormatter.clearCache();
    
    const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, entryPrice);
    const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
    
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
    
    // Validate against maximum order amount from config
    const maxOrderAmount = config.max_order_amount_usd || 100;
    if (orderValue > maxOrderAmount) {
      console.log(`❌ TradeValidator: Order value ${orderValue.toFixed(2)} exceeds maximum ${maxOrderAmount}`);
      return false;
    }

    console.log(`✅ TradeValidator: Trade parameters valid for ${symbol}: $${orderValue.toFixed(2)}`);
    return true;
  }

  static async calculateQuantity(symbol: string, orderAmount: number, entryPrice: number, config: TradingConfigData): Promise<number> {
    try {
      console.log(`🧮 TradeValidator: Calculating quantity for ${symbol}`);
      
      // CRITICAL: Use ONLY BybitPrecisionFormatter for accurate calculation
      BybitPrecisionFormatter.clearCache();
      const quantity = await BybitPrecisionFormatter.calculateQuantity(symbol, orderAmount, entryPrice);
      
      console.log(`📊 TradeValidator quantity calculation for ${symbol}:`, {
        orderAmount: orderAmount.toFixed(2),
        entryPrice: await BybitPrecisionFormatter.formatPrice(symbol, entryPrice),
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
      
      // CRITICAL: Use ONLY BybitPrecisionFormatter
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      const parsedQuantity = parseFloat(formattedQuantity);
      
      // Check if the formatted quantity matches the original (within tolerance)
      const tolerance = 0.0001;
      const isValid = Math.abs(quantity - parsedQuantity) <= tolerance;
      
      console.log(`📊 TradeValidator precision check: original=${quantity}, formatted="${formattedQuantity}", parsed=${parsedQuantity}, valid=${isValid}`);
      
      return isValid;
    } catch (error) {
      console.error(`❌ TradeValidator error validating quantity precision for ${symbol}:`, error);
      return false;
    }
  }

  static validatePriceRange(currentPrice: number, entryPrice: number, maxDeviationPercent: number = 5): boolean {
    const deviation = Math.abs((entryPrice - currentPrice) / currentPrice) * 100;
    
    if (deviation > maxDeviationPercent) {
      console.error(`❌ TradeValidator: Entry price deviation too high: ${deviation.toFixed(2)}% (max: ${maxDeviationPercent}%)`);
      return false;
    }
    
    console.log(`✅ TradeValidator: Price range validation passed: ${deviation.toFixed(2)}% deviation`);
    return true;
  }
}
