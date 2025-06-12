
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { TradeRecorder } from './TradeRecorder';
import { OrderExecutor } from './OrderExecutor';

export interface OrderPlacementResult {
  success: boolean;
  buyOrderId?: string;
  sellOrderId?: string;
  error?: string;
}

export class OrderPlacer {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private orderExecutor: OrderExecutor;

  constructor(userId: string, bybitService: BybitService) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId is required for OrderPlacer');
    }
    
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
    // Validate inputs
    if (!signal || !signal.symbol || !signal.signal_type) {
      throw new Error('Invalid signal: missing required properties (symbol, signal_type)');
    }
    
    if (quantity <= 0 || entryPrice <= 0 || takeProfitPrice <= 0) {
      throw new Error('Invalid order parameters: quantity, entryPrice, and takeProfitPrice must be positive');
    }

    if (takeProfitPrice <= entryPrice) {
      throw new Error('Invalid order parameters: takeProfitPrice must be greater than entryPrice');
    }

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

      // Execute buy order - Fixed the syntax error here
      const buyResult = await this.orderExecutor.executeBuyOrder(signal.symbol, quantity, entryPrice);
      
      if (!buyResult.success) {
        throw new Error(`Buy order failed: ${buyResult.error}`);
      }

      console.log(`✅ Buy order placed successfully: ${buyResult.orderId}`);

      // Record the trade in database
      const tradeRecorder = new TradeRecorder(this.userId);
      await tradeRecorder.recordBuyOrder(
        signal.symbol,
        quantity,
        entryPrice,
        buyResult.orderId!,
        signal.id
      );

      console.log(`🎉 Order placement completed successfully for ${signal.symbol}`);
      await this.logger.logSuccess(`Order placement completed for ${signal.symbol}`, {
        buyOrderId: buyResult.orderId,
        symbol: signal.symbol,
        quantity,
        entryPrice,
        takeProfitPrice
      });

    } catch (error) {
      console.error(`❌ Error placing orders for ${signal.symbol}:`, error);
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
