
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class TradeValidator {
  static validateTradeParameters(symbol: string, quantity: number, entryPrice: number, config: TradingConfigData): boolean {
    // Check minimum notional using config values
    const orderValue = quantity * entryPrice;
    const minNotional = config.minimum_notional_per_symbol?.[symbol] || 10; // Use config or default
    
    if (orderValue < minNotional) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} below minimum ${minNotional} for ${symbol}`);
      return false;
    }

    // Validate calculation results
    if (isNaN(entryPrice) || isNaN(quantity) || quantity <= 0 || entryPrice <= 0) {
      console.error(`❌ Invalid calculation results: entryPrice=${entryPrice}, quantity=${quantity}`);
      return false;
    }

    // Validate against maximum order amount
    if (orderValue > config.max_order_amount_usd) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} exceeds maximum ${config.max_order_amount_usd}`);
      return false;
    }

    return true;
  }

  static calculateQuantity(symbol: string, orderAmount: number, entryPrice: number, config: TradingConfigData): number {
    // Calculate quantity with proper formatting using config
    const rawQuantity = orderAmount / entryPrice;
    const increment = config.quantity_increment_per_symbol?.[symbol] || 0.0001; // Use config or default
    const adjustedQuantity = Math.floor(rawQuantity / increment) * increment;
    
    console.log(`  Raw Quantity: ${rawQuantity.toFixed(6)}`);
    console.log(`  Increment for ${symbol}: ${increment}`);
    console.log(`  Adjusted Quantity: ${adjustedQuantity.toFixed(6)}`);
    
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
}
