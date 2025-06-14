
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class TradeValidator {
  static validateTradeParameters(symbol: string, quantity: number, entryPrice: number, config: TradingConfigData): boolean {
    // Validate basic parameters
    if (isNaN(entryPrice) || isNaN(quantity) || quantity <= 0 || entryPrice <= 0) {
      console.error(`❌ Invalid calculation results: entryPrice=${entryPrice}, quantity=${quantity}`);
      return false;
    }

    const orderValue = quantity * entryPrice;
    
    // Check minimum notional using config values
    const minNotional = config.minimum_notional_per_symbol?.[symbol] || 10;
    
    if (orderValue < minNotional) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} below minimum ${minNotional} for ${symbol}`);
      return false;
    }

    // Validate against maximum order amount
    const maxOrderAmount = config.max_order_amount_usd || 100;
    if (orderValue > maxOrderAmount) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} exceeds maximum ${maxOrderAmount}`);
      return false;
    }

    // Validate quantity precision
    if (!this.validateQuantityPrecision(symbol, quantity, config)) {
      return false;
    }

    console.log(`✅ Trade parameters valid for ${symbol}: $${orderValue.toFixed(2)} (${quantity.toFixed(6)} @ $${entryPrice.toFixed(6)})`);
    return true;
  }

  static calculateQuantity(symbol: string, orderAmount: number, entryPrice: number, config: TradingConfigData): number {
    // Calculate raw quantity
    const rawQuantity = orderAmount / entryPrice;
    
    // Get quantity increment from config
    const increment = config.quantity_increment_per_symbol?.[symbol] || 0.0001;
    
    // Round down to nearest increment
    const adjustedQuantity = Math.floor(rawQuantity / increment) * increment;
    
    console.log(`📊 Quantity calculation for ${symbol}:`, {
      orderAmount: orderAmount.toFixed(2),
      entryPrice: entryPrice.toFixed(6),
      rawQuantity: rawQuantity.toFixed(6),
      increment: increment,
      adjustedQuantity: adjustedQuantity.toFixed(6)
    });
    
    return adjustedQuantity;
  }

  static validateQuantityPrecision(symbol: string, quantity: number, config: TradingConfigData): boolean {
    const increment = config.quantity_increment_per_symbol?.[symbol] || 0.0001;
    const remainder = quantity % increment;
    
    // Check if quantity is properly aligned with increment (within tolerance)
    const tolerance = increment / 1000; // Very small tolerance for floating point precision
    
    if (remainder > tolerance && (increment - remainder) > tolerance) {
      console.error(`❌ Quantity ${quantity} not aligned with increment ${increment} for ${symbol}`);
      return false;
    }
    
    return true;
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
