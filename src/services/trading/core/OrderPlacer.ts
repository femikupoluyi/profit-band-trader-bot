
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

  /**
   * Legacy method for backwards compatibility
   */
  async placeOrder(
    signal: any,
    quantity: number,
    entryPrice: number,
    takeProfitPrice: number
  ): Promise<OrderPlacementResult> {
    try {
      await this.placeRealBybitOrder(signal, quantity, entryPrice, takeProfitPrice);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate order parameters before placement
   */
  private validateOrderParameters(
    signal: any,
    quantity: number,
    entryPrice: number,
    takeProfitPrice: number
  ): { isValid: boolean; error?: string } {
    if (!signal?.symbol) {
      return { isValid: false, error: 'Signal must have a valid symbol' };
    }

    if (!signal?.signal_type) {
      return { isValid: false, error: 'Signal must have a valid signal_type' };
    }

    if (quantity <= 0) {
      return { isValid: false, error: 'Quantity must be positive' };
    }

    if (entryPrice <= 0) {
      return { isValid: false, error: 'Entry price must be positive' };
    }

    if (takeProfitPrice <= 0) {
      return { isValid: false, error: 'Take profit price must be positive' };
    }

    if (takeProfitPrice <= entryPrice) {
      return { isValid: false, error: 'Take profit price must be higher than entry price' };
    }

    return { isValid: true };
  }
}
