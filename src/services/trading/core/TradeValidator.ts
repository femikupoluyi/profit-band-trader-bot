
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';

export class TradeValidator {
  static async validateTradeParameters(symbol: string, quantity: number, entryPrice: number, config: TradingConfigData): Promise<boolean> {
    // Validate basic parameters
    if (isNaN(entryPrice) || isNaN(quantity) || quantity <= 0 || entryPrice <= 0) {
      console.error(`❌ Invalid calculation results: entryPrice=${entryPrice}, quantity=${quantity}`);
      return false;
    }

    // Format and validate using Bybit precision
    const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, entryPrice);
    const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
    
    const finalPrice = parseFloat(formattedPrice);
    const finalQuantity = parseFloat(formattedQuantity);

    // Validate using Bybit requirements
    const isValidOrder = await BybitPrecisionFormatter.validateOrder(symbol, finalPrice, finalQuantity);
    if (!isValidOrder) {
      console.error(`❌ Order validation failed for ${symbol}`);
      return false;
    }

    const orderValue = finalQuantity * finalPrice;
    
    // Validate against maximum order amount from config
    const maxOrderAmount = config.max_order_amount_usd || 100;
    if (orderValue > maxOrderAmount) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} exceeds maximum ${maxOrderAmount}`);
      return false;
    }

    console.log(`✅ Trade parameters valid for ${symbol}: $${orderValue.toFixed(2)}`);
    return true;
  }

  static async calculateQuantity(symbol: string, orderAmount: number, entryPrice: number, config: TradingConfigData): Promise<number> {
    try {
      // Use Bybit precision formatter for accurate calculation
      const quantity = await BybitPrecisionFormatter.calculateQuantity(symbol, orderAmount, entryPrice);
      
      console.log(`📊 Quantity calculation for ${symbol}:`, {
        orderAmount: orderAmount.toFixed(2),
        entryPrice: await BybitPrecisionFormatter.formatPrice(symbol, entryPrice),
        calculatedQuantity: await BybitPrecisionFormatter.formatQuantity(symbol, quantity)
      });
      
      return quantity;
    } catch (error) {
      console.error(`❌ Error calculating quantity for ${symbol}:`, error);
      throw error;
    }
  }

  static async validateQuantityPrecision(symbol: string, quantity: number): Promise<boolean> {
    try {
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      const parsedQuantity = parseFloat(formattedQuantity);
      
      // Check if the formatted quantity matches the original (within tolerance)
      const tolerance = 0.0001;
      return Math.abs(quantity - parsedQuantity) <= tolerance;
    } catch (error) {
      console.error(`❌ Error validating quantity precision for ${symbol}:`, error);
      return false;
    }
  }

  static validatePriceRange(currentPrice: number, entryPrice: number, maxDeviationPercent: number = 5): boolean {
    const deviation = Math.abs((entryPrice - currentPrice) / currentPrice) * 100;
    
    if (deviation > maxDeviationPercent) {
      console.error(`❌ Entry price deviation too high: ${deviation.toFixed(2)}% (max: ${maxDeviationPercent}%)`);
      return false;
    }
    
    return true;
  }
}
