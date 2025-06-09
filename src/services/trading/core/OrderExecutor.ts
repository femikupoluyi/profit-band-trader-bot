
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { OrderFormatter } from './OrderFormatter';

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

      // Format the order using OrderFormatter
      const formattedOrder = await OrderFormatter.formatBuyOrder(symbol, quantity, entryPrice);
      
      console.log(`📊 Placing BUY order with formatted values:
        - Symbol: ${symbol}
        - Quantity: ${formattedOrder.quantity}
        - Price: ${formattedOrder.price}`);

      // Place the buy order
      const buyOrderResult = await this.bybitService.placeOrder({
        category: 'spot',
        symbol: symbol,
        side: 'Buy',
        orderType: 'Limit',
        qty: formattedOrder.quantity,
        price: formattedOrder.price,
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
        quantity: formattedOrder.quantity,
        price: formattedOrder.price
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

      // Format the sell order
      const formattedOrder = await OrderFormatter.formatSellOrder(symbol, quantity, price, instrumentInfo);

      console.log(`📊 Placing SELL order with formatted values:
        - Symbol: ${symbol}
        - Quantity: ${formattedOrder.quantity}
        - Price: ${formattedOrder.price}`);

      // Place the sell order
      const sellOrderResult = await this.bybitService.placeOrder({
        category: 'spot',
        symbol: symbol,
        side: 'Sell',
        orderType: 'Limit',
        qty: formattedOrder.quantity,
        price: formattedOrder.price,
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
        quantity: formattedOrder.quantity,
        price: formattedOrder.price
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
