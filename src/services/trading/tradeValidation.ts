
import { TRADING_ENVIRONMENT } from './core/TypeDefinitions';
import { BybitInstrumentService } from './core/BybitInstrumentService';
import { getSupportedTradingPairs } from '@/components/trading/test/testConstants';

export class TradeValidation {
  static async getFormattedQuantity(symbol: string, quantity: number): Promise<string> {
    // Use BybitInstrumentService for consistent formatting
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (instrumentInfo) {
      return BybitInstrumentService.formatQuantity(symbol, quantity, instrumentInfo);
    }
    
    // Fallback to basic formatting
    return quantity.toFixed(4);
  }

  static async isValidOrderValue(symbol: string, quantity: number, price: number): Promise<boolean> {
    return await this.validateMinOrderValue(symbol, quantity, price);
  }

  private static async validateMinOrderValue(symbol: string, quantity: number, price: number): Promise<boolean> {
    // Get instrument info for proper validation
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (instrumentInfo) {
      return BybitInstrumentService.validateOrder(symbol, price, quantity, instrumentInfo);
    }

    // Fallback validation
    const orderValue = quantity * price;
    const minValue = this.getMinimumOrderValue(symbol);
    
    console.log(`[${TRADING_ENVIRONMENT.isDemoTrading ? 'DEMO' : 'LIVE'}] Order value validation for ${symbol}: ${orderValue.toFixed(2)} USD (min: ${minValue})`);
    
    if (orderValue < minValue) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} below minimum ${minValue}`);
      return false;
    }
    
    return true;
  }

  static validateSymbol(symbol: string): boolean {
    const supportedSymbols = getSupportedTradingPairs();
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

  static getSupportedSymbols(): string[] {
    return getSupportedTradingPairs();
  }
}
