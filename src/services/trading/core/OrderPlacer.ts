
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { TradeRecorder } from './TradeRecorder';
import { OrderExecutor } from './OrderExecutor';

export class OrderPlacer {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private orderExecutor: OrderExecutor;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.orderExecutor = new OrderExecutor(userId, bybitService);
  }

  async placeRealBybitOrder(
    signal: any,
    quantity: number,
    entryPrice: number,
    takeProfitPrice: number
  ): Promise<void> {
    try {
      console.log(`\n🎯 ===== PLACING REAL BYBIT ORDERS =====`);
      console.log(`📊 Signal: ${signal.symbol} ${signal.signal_type}`);
      console.log(`📈 Entry Price: ${entryPrice}`);
      console.log(`📈 Take-Profit Price: ${takeProfitPrice}`);
      console.log(`📦 Quantity: ${quantity}`);

      await this.logger.logSuccess(`Starting order placement for ${signal.symbol}`, {
        signal: signal.signal_type,
        entryPrice,
        takeProfitPrice,
        quantity
      });

      // Execute buy order
      const buyResult = await this.orderExecutor.executeBuyOrder(signal.symbol, quantity, entryPrice);
      
      if (!buyResult.success) {
        throw new Error(`Buy order failed: ${buyResult.error}`);
      }

      // Record the buy trade
      const buyTradeData = {
        userId: this.userId,
        symbol: signal.symbol,
        side: 'buy' as const,
        orderType: 'limit' as const,
        price: entryPrice,
        quantity: quantity,
        status: 'new',
        bybitOrderId: buyResult.orderId!
      };

      const buyTrade = await TradeRecorder.createTradeRecord(buyTradeData);
      console.log(`📝 BUY trade recorded in database:`, buyTrade.id);

      // Execute take-profit sell order
      const sellResult = await this.orderExecutor.executeSellOrder(
        signal.symbol, 
        quantity, 
        takeProfitPrice, 
        null // instrumentInfo will be fetched in OrderFormatter
      );

      if (!sellResult.success) {
        console.warn(`⚠️ Take-profit order failed: ${sellResult.error}`);
        await this.logger.logError(`Take-profit order failed for ${signal.symbol}`, sellResult.error, {
          symbol: signal.symbol,
          takeProfitPrice,
          quantity
        });
      } else {
        // Record the sell trade
        const sellTradeData = {
          userId: this.userId,
          symbol: signal.symbol,
          side: 'sell' as const,
          orderType: 'limit' as const,
          price: takeProfitPrice,
          quantity: quantity,
          status: 'new',
          bybitOrderId: sellResult.orderId!
        };

        const sellTrade = await TradeRecorder.createTradeRecord(sellTradeData);
        console.log(`📝 SELL trade recorded in database:`, sellTrade.id);
      }

      await this.logger.logSuccess(`Order placement completed for ${signal.symbol}`, {
        buyOrderId: buyResult.orderId,
        sellOrderId: sellResult.orderId,
        symbol: signal.symbol,
        entryPrice,
        takeProfitPrice,
        quantity
      });

      console.log(`✅ ===== ORDER PLACEMENT COMPLETE =====\n`);

    } catch (error) {
      console.error(`❌ Error in order placement for ${signal.symbol}:`, error);
      await this.logger.logError(`Order placement failed for ${signal.symbol}`, error, {
        signal: signal.signal_type,
        entryPrice,
        takeProfitPrice,
        quantity
      });
      throw error;
    }
  }
}
