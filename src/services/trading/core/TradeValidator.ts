
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class TradeValidator {
  static validateTradeParameters(symbol: string, quantity: number, entryPrice: number, config: TradingConfigData): boolean {
    // Check minimum notional
    const orderValue = quantity * entryPrice;
    const minNotional = config.minimum_notional_per_symbol?.[symbol] || 10;
    
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
    const increment = config.quantity_increment_per_symbol?.[symbol] || 0.0001;
    const adjustedQuantity = Math.floor(rawQuantity / increment) * increment;
    
    console.log(`  Raw Quantity: ${rawQuantity.toFixed(6)}`);
    console.log(`  Adjusted Quantity: ${adjustedQuantity.toFixed(6)}`);
    
    return adjustedQuantity;
  }
}
