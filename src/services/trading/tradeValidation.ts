
import { TRADING_ENVIRONMENT } from './core/TypeDefinitions';
import { PriceFormatter } from './core/PriceFormatter';

export class TradeValidation {
  static getFormattedQuantity(symbol: string, quantity: number): string {
    // Use PriceFormatter for consistent formatting
    return PriceFormatter.formatQuantityForSymbol(symbol, quantity);
  }

  static isValidOrderValue(symbol: string, quantity: number, price: number): boolean {
    return this.validateMinOrderValue(symbol, quantity, price);
  }

  private static validateMinOrderValue(symbol: string, quantity: number, price: number): boolean {
    const orderValue = quantity * price;
    
    // Conservative minimum order values for demo trading
    const minOrderValues: Record<string, number> = {
      'BTCUSDT': 25,
      'ETHUSDT': 25,
      'BNBUSDT': 25,
      'SOLUSDT': 25,
      'LTCUSDT': 25,
      'ADAUSDT': 15,
      'XRPUSDT': 15,
      'DOGEUSDT': 15,
      'MATICUSDT': 15,
      'FETUSDT': 15,
      'POLUSDT': 15,
      'XLMUSDT': 15,
    };

    const minValue = minOrderValues[symbol] || 25;
    
    console.log(`[${TRADING_ENVIRONMENT.isDemoTrading ? 'DEMO' : 'LIVE'}] Order value validation for ${symbol}: ${orderValue.toFixed(2)} USD (min: ${minValue})`);
    
    if (orderValue < minValue) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} below minimum ${minValue}`);
      return false;
    }
    
    return true;
  }

  static validateSymbol(symbol: string): boolean {
    const supportedSymbols = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 
      'XRPUSDT', 'LTCUSDT', 'DOGEUSDT', 'MATICUSDT', 'FETUSDT', 
      'POLUSDT', 'XLMUSDT'
    ];
    
    return supportedSymbols.includes(symbol);
  }

  static getMinimumOrderValue(symbol: string): number {
    const minOrderValues: Record<string, number> = {
      'BTCUSDT': 25, 'ETHUSDT': 25, 'BNBUSDT': 25, 'SOLUSDT': 25, 'LTCUSDT': 25,
      'ADAUSDT': 15, 'XRPUSDT': 15, 'DOGEUSDT': 15, 'MATICUSDT': 15, 'FETUSDT': 15,
      'POLUSDT': 15, 'XLMUSDT': 15
    };
    
    return minOrderValues[symbol] || 25;
  }
}
