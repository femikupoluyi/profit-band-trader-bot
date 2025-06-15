
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';

export interface OrderExecutionResult {
  success: boolean;
  buyOrderId?: string;
  sellOrderId?: string;
  error?: string;
}

export class OrderExecutor {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
  }

  async executeBuyOrder(
    symbol: string,
    quantity: number,
    entryPrice: number
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      console.log(`🔄 Executing BUY order for ${symbol}: ${quantity} @ ${entryPrice}`);

      // Clear cache and format using Bybit precision formatter
      BybitPrecisionFormatter.clearCache();
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, entryPrice);
      
      console.log(`📊 Placing BUY order with FORMATTED values:
        - Symbol: ${symbol}
        - Quantity: "${formattedQuantity}" (original: ${quantity})
        - Price: "${formattedPrice}" (original: ${entryPrice})`);

      // Final validation with formatted values
      const finalPrice = parseFloat(formattedPrice);
      const finalQuantity = parseFloat(formattedQuantity);
      const isValid = await BybitPrecisionFormatter.validateOrder(symbol, finalPrice, finalQuantity);
      
      if (!isValid) {
        throw new Error(`Order validation failed after formatting: qty=${formattedQuantity}, price=${formattedPrice}`);
      }

      // Place the buy order with string values
      const buyOrderResult = await this.bybitService.placeOrder({
        category: 'spot',
        symbol: symbol,
        side: 'Buy',
        orderType: 'Limit',
        qty: formattedQuantity,
        price: formattedPrice,
        timeInForce: 'GTC'
      });

      if (buyOrderResult.retCode !== 0) {
        throw new Error(`Bybit buy order failed: ${buyOrderResult.retMsg}`);
      }

      const buyOrderId = buyOrderResult.result?.orderId;
      if (!buyOrderId) {
        throw new Error('No order ID returned from Bybit buy order');
      }

      console.log(`✅ BUY order placed successfully: ${buyOrderId}`);
      await this.logger.logSuccess(`BUY order placed for ${symbol}`, {
        symbol,
        orderId: buyOrderId,
        quantity: formattedQuantity,
        price: formattedPrice,
        originalQuantity: quantity,
        originalPrice: entryPrice
      });

      return { success: true, orderId: buyOrderId };

    } catch (error) {
      console.error(`❌ Error placing BUY order for ${symbol}:`, error);
      await this.logger.logError(`BUY order failed for ${symbol}`, error, {
        symbol,
        quantity,
        entryPrice
      });
      return { success: false, error: error.message };
    }
  }

  async executeSellOrder(
    symbol: string,
    quantity: number,
    price: number,
    instrumentInfo: any
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      console.log(`🔄 Executing SELL order for ${symbol}: ${quantity} @ ${price}`);

      // Clear cache and format using Bybit precision formatter
      BybitPrecisionFormatter.clearCache();
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, price);

      console.log(`📊 Placing SELL order with FORMATTED values:
        - Symbol: ${symbol}
        - Quantity: "${formattedQuantity}" (original: ${quantity})
        - Price: "${formattedPrice}" (original: ${price})`);

      // Final validation with formatted values
      const finalPrice = parseFloat(formattedPrice);
      const finalQuantity = parseFloat(formattedQuantity);
      const isValid = await BybitPrecisionFormatter.validateOrder(symbol, finalPrice, finalQuantity);
      
      if (!isValid) {
        throw new Error(`Sell order validation failed after formatting: qty=${formattedQuantity}, price=${formattedPrice}`);
      }

      // Place the sell order with string values
      const sellOrderResult = await this.bybitService.placeOrder({
        category: 'spot',
        symbol: symbol,
        side: 'Sell',
        orderType: 'Limit',
        qty: formattedQuantity,
        price: formattedPrice,
        timeInForce: 'GTC'
      });

      if (sellOrderResult.retCode !== 0) {
        throw new Error(`Bybit sell order failed: ${sellOrderResult.retMsg}`);
      }

      const sellOrderId = sellOrderResult.result?.orderId;
      if (!sellOrderId) {
        throw new Error('No order ID returned from Bybit sell order');
      }

      console.log(`✅ SELL order placed successfully: ${sellOrderId}`);
      await this.logger.logSuccess(`SELL order placed for ${symbol}`, {
        symbol,
        orderId: sellOrderId,
        quantity: formattedQuantity,
        price: formattedPrice,
        originalQuantity: quantity,
        originalPrice: price
      });

      return { success: true, orderId: sellOrderId };

    } catch (error) {
      console.error(`❌ Error placing SELL order for ${symbol}:`, error);
      await this.logger.logError(`SELL order failed for ${symbol}`, error, {
        symbol,
        quantity,
        price
      });
      return { success: false, error: error.message };
    }
  }
}
