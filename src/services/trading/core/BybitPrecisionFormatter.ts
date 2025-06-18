
import { PriceFormatter } from './precision/PriceFormatter';
import { QuantityFormatter } from './precision/QuantityFormatter';
import { OrderValidator } from './precision/OrderValidator';
import { BybitInstrumentService } from './BybitInstrumentService';

export class BybitPrecisionFormatter {
  static async formatPrice(symbol: string, price: number): Promise<string> {
    return PriceFormatter.formatPrice(symbol, price);
  }

  static async formatQuantity(symbol: string, quantity: number): Promise<string> {
    return QuantityFormatter.formatQuantity(symbol, quantity);
  }

  static async validateOrder(symbol: string, price: number, quantity: number): Promise<boolean> {
    return OrderValidator.validateOrder(symbol, price, quantity);
  }

  static async calculateQuantity(symbol: string, orderAmount: number, price: number): Promise<number> {
    return QuantityFormatter.calculateQuantity(symbol, orderAmount, price);
  }

  static clearCache(): void {
    BybitInstrumentService.clearCache();
    console.log('🧹 Cleared BybitPrecisionFormatter cache');
  }
}
