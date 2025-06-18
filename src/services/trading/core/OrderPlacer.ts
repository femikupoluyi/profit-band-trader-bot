
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { OrderExecution } from './OrderExecution';
import { ServiceContainer } from './ServiceContainer';

export class OrderPlacer {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private orderExecution: OrderExecution;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = ServiceContainer.getLogger(userId);
    this.orderExecution = ServiceContainer.getOrderExecution(userId, bybitService);
  }

  async placeRealBybitOrder(
    signal: any,
    quantity: number,
    entryPrice: number,
    takeProfitPrice: number
  ): Promise<void> {
    try {
      console.log(`\n🎯 ===== PLACING REAL BYBIT ORDERS FOR ${signal.symbol} =====`);
      console.log(`📊 Signal ID: ${signal.id}`);
      console.log(`📊 Order Parameters:
        - Symbol: ${signal.symbol}
        - Quantity: ${quantity}
        - Entry Price: $${entryPrice.toFixed(6)}
        - Take Profit: $${takeProfitPrice.toFixed(6)}`);

      // Step 1: Place BUY order
      const buyResult = await this.orderExecution.executeBuyOrder(signal.symbol, quantity, entryPrice);
      
      if (!buyResult.success) {
        throw new Error(`Buy order failed: ${buyResult.error}`);
      }

      console.log(`✅ BUY order placed successfully: ${buyResult.orderId}`);

      // Step 2: Store the trade in database
      const dbHelper = ServiceContainer.getDatabaseHelper(this.userId);
      const tradeRecord = await dbHelper.createTrade({
        user_id: this.userId,
        symbol: signal.symbol,
        side: 'buy',
        price: entryPrice,
        quantity,
        order_type: 'limit',
        status: 'pending',
        bybit_order_id: buyResult.orderId
      });

      console.log(`✅ Trade recorded in database: ${tradeRecord.id}`);

      // Step 3: Place SELL order (take profit)
      const sellResult = await this.orderExecution.executeSellOrder(signal.symbol, quantity, takeProfitPrice);
      
      if (!sellResult.success) {
        console.warn(`⚠️ Take profit order failed: ${sellResult.error}`);
        await this.logger.logError(`Take profit order failed for ${signal.symbol}`, new Error(sellResult.error!), {
          signalId: signal.id,
          buyOrderId: buyResult.orderId
        });
      } else {
        console.log(`✅ SELL order placed successfully: ${sellResult.orderId}`);
        
        // Store sell order in database
        await dbHelper.createTrade({
          user_id: this.userId,
          symbol: signal.symbol,
          side: 'sell',
          price: takeProfitPrice,
          quantity,
          order_type: 'limit',
          status: 'pending',
          bybit_order_id: sellResult.orderId
        });
      }

      await this.logger.logSuccess(`Orders placed for ${signal.symbol}`, {
        signalId: signal.id,
        buyOrderId: buyResult.orderId,
        sellOrderId: sellResult.orderId || 'N/A',
        tradeRecordId: tradeRecord.id
      });

      console.log(`✅ ===== ORDER PLACEMENT COMPLETE FOR ${signal.symbol} =====\n`);

    } catch (error) {
      console.error(`❌ CRITICAL ERROR placing orders for ${signal.symbol}:`, error);
      await this.logger.logError(`Order placement failed for ${signal.symbol}`, error, {
        signalId: signal.id,
        orderParameters: { quantity, entryPrice, takeProfitPrice }
      });
      throw error;
    }
  }
}
