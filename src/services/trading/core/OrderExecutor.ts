
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { OrderExecution } from './OrderExecution';

export interface OrderExecutionResult {
  success: boolean;
  buyOrderId?: string;
  sellOrderId?: string;
  error?: string;
}

/**
 * REFACTORED: OrderExecutor now delegates to focused OrderExecution service
 * This maintains the same interface but with cleaner, more maintainable code
 */
export class OrderExecutor {
  private userId: string;
  private orderExecution: OrderExecution;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.orderExecution = new OrderExecution(userId, bybitService);
    this.logger = new TradingLogger(userId);
  }

  async executeBuyOrder(
    symbol: string,
    quantity: number,
    entryPrice: number
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    console.log(`\n🔄 ===== OrderExecutor: Delegating BUY order to OrderExecution =====`);
    
    return await this.orderExecution.executeBuyOrder(symbol, quantity, entryPrice);
  }

  async executeSellOrder(
    symbol: string,
    quantity: number,
    price: number,
    instrumentInfo: any
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    console.log(`\n🔄 ===== OrderExecutor: Delegating SELL order to OrderExecution =====`);
    
    return await this.orderExecution.executeSellOrder(symbol, quantity, price);
  }
}
