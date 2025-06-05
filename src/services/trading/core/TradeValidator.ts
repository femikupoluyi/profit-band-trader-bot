
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class TradeValidator {
  static validateTradeParameters(symbol: string, quantity: number, entryPrice: number, config: TradingConfigData): boolean {
    // Check minimum notional - use default if not available
    const orderValue = quantity * entryPrice;
    const minNotional = 10; // Default minimum notional
    
    if (orderValue < minNotional) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} below minimum ${minNotional}`);
      return false;
    }

    // Validate calculation results
    if (isNaN(entryPrice) || isNaN(quantity) || quantity <= 0 || entryPrice <= 0) {
      console.error(`❌ Invalid calculation results: entryPrice=${entryPrice}, quantity=${quantity}`);
      return false;
    }

    return true;
  }

  static calculateQuantity(symbol: string, orderAmount: number, entryPrice: number, config: TradingConfigData): number {
    // Calculate quantity with proper formatting
    const rawQuantity = orderAmount / entryPrice;
    const increment = 0.0001; // Default increment
    const adjustedQuantity = Math.floor(rawQuantity / increment) * increment;
    
    console.log(`  Raw Quantity: ${rawQuantity.toFixed(6)}`);
    console.log(`  Adjusted Quantity: ${adjustedQuantity.toFixed(6)}`);
    
    return adjustedQuantity;
  }
}
