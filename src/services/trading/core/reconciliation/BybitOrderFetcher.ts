import { BybitService } from '../../../bybitService';
import { TradingLogger } from '../TradingLogger';

export interface BybitTransactionRecord {
  symbol: string;
  side: string;
  execTime: string;
  execPrice: string;
  execQty: string;
  orderId: string;
  execType: string;
  execValue: string;
  feeRate: string;
  tradeId: string;
}

export class BybitOrderFetcher {
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(bybitService: BybitService, logger: TradingLogger) {
    this.bybitService = bybitService;
    this.logger = logger;
  }

  async getBybitExecutionHistory(lookbackHours: number): Promise<BybitTransactionRecord[]> {
    try {
      // Calculate start time
      const startTime = Date.now() - (lookbackHours * 60 * 60 * 1000);
      
      console.log(`📈 Fetching Bybit execution history from ${new Date(startTime).toISOString()}`);
      
      // CRITICAL: Get order history from Bybit to compare with local records
      console.log('📊 CRITICAL: Fetching Bybit order history for reconciliation...');
      const response = await this.bybitService.getOrderHistory(100);

      if (response.retCode !== 0) {
        console.error('❌ CRITICAL: Failed to fetch Bybit execution history:', response.retMsg);
        await this.logger.logError('Bybit order history fetch failed', new Error(response.retMsg));
        return [];
      }

      // Convert order history to execution records format
      const executionRecords: BybitTransactionRecord[] = [];
      const orders = response.result?.list || [];
      
      console.log(`📊 CRITICAL: Found ${orders.length} orders in Bybit history`);

      for (const order of orders) {
        // Include ALL orders (not just filled ones) to detect pending orders
        const orderTime = parseInt(order.updatedTime || order.createdTime);
        if (orderTime >= startTime) {
          console.log(`📊 Processing Bybit order: ${order.symbol} ${order.side} ${order.qty} @ ${order.avgPrice || order.price} (ID: ${order.orderId}) - Status: ${order.orderStatus}`);
          executionRecords.push({
            symbol: order.symbol,
            side: order.side,
            execTime: order.updatedTime || order.createdTime,
            execPrice: order.avgPrice || order.price,
            execQty: order.qty,
            orderId: order.orderId,
            execType: order.orderStatus === 'Filled' ? 'Trade' : 'Order',
            execValue: (parseFloat(order.avgPrice || order.price) * parseFloat(order.qty)).toString(),
            feeRate: '0', // Not available in order history
            tradeId: order.orderId // Use orderId as tradeId since we don't have separate trade IDs
          });
        }
      }

      console.log(`📊 CRITICAL: Created ${executionRecords.length} execution records from Bybit data`);
      return executionRecords;
    } catch (error) {
      console.error('Error fetching Bybit execution history:', error);
      await this.logger.logError('Failed to fetch Bybit execution history', error);
      return [];
    }
  }
}