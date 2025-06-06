import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';

interface BybitTransactionRecord {
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

export class TransactionReconciliationService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
  }

  async reconcileWithBybitHistory(lookbackHours: number = 24): Promise<void> {
    try {
      console.log('🔄 Starting transaction reconciliation with Bybit...');
      await this.logger.logSuccess('Starting transaction reconciliation');

      // Get recent execution history from Bybit
      const bybitExecutions = await this.getBybitExecutionHistory(lookbackHours);
      
      if (!bybitExecutions || bybitExecutions.length === 0) {
        console.log('📭 No recent executions found on Bybit');
        return;
      }

      console.log(`📊 Found ${bybitExecutions.length} executions on Bybit to reconcile`);

      // Get our local trades for comparison
      const localTrades = await this.getLocalTrades(lookbackHours);
      
      // Reconcile each Bybit execution
      for (const execution of bybitExecutions) {
        await this.reconcileSingleExecution(execution, localTrades);
      }

      // Check for missing local records
      await this.identifyMissingLocalRecords(bybitExecutions, localTrades);

      console.log('✅ Transaction reconciliation completed');
      await this.logger.logSuccess('Transaction reconciliation completed');

    } catch (error) {
      console.error('❌ Error during transaction reconciliation:', error);
      await this.logger.logError('Transaction reconciliation failed', error);
    }
  }

  private async getBybitExecutionHistory(lookbackHours: number): Promise<BybitTransactionRecord[]> {
    try {
      // Calculate start time
      const startTime = Date.now() - (lookbackHours * 60 * 60 * 1000);
      
      console.log(`📈 Fetching Bybit execution history from ${new Date(startTime).toISOString()}`);
      
      // Use the existing getOrderHistory method as it returns filled orders which are our executions
      const response = await this.bybitService.getOrderHistory(100);

      if (response.retCode !== 0) {
        console.error('Failed to fetch Bybit execution history:', response.retMsg);
        return [];
      }

      // Convert order history to execution records format
      const executionRecords: BybitTransactionRecord[] = [];
      const orders = response.result?.list || [];

      for (const order of orders) {
        // Only include filled orders within our time window
        const orderTime = parseInt(order.updatedTime || order.createdTime);
        if (orderTime >= startTime && order.orderStatus === 'Filled') {
          executionRecords.push({
            symbol: order.symbol,
            side: order.side,
            execTime: order.updatedTime || order.createdTime,
            execPrice: order.avgPrice || order.price,
            execQty: order.qty,
            orderId: order.orderId,
            execType: 'Trade',
            execValue: (parseFloat(order.avgPrice || order.price) * parseFloat(order.qty)).toString(),
            feeRate: '0', // Not available in order history
            tradeId: order.orderId // Use orderId as tradeId since we don't have separate trade IDs
          });
        }
      }

      return executionRecords;
    } catch (error) {
      console.error('Error fetching Bybit execution history:', error);
      await this.logger.logError('Failed to fetch Bybit execution history', error);
      return [];
    }
  }

  private async getLocalTrades(lookbackHours: number): Promise<any[]> {
    const startTime = new Date(Date.now() - (lookbackHours * 60 * 60 * 1000)).toISOString();
    
    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', this.userId)
      .gte('created_at', startTime)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching local trades:', error);
      return [];
    }

    return trades || [];
  }

  private async reconcileSingleExecution(
    execution: BybitTransactionRecord, 
    localTrades: any[]
  ): Promise<void> {
    try {
      // Try to find matching local trade
      const matchingTrade = this.findMatchingLocalTrade(execution, localTrades);
      
      if (matchingTrade) {
        // Update existing trade with Bybit execution details
        await this.updateExistingTrade(matchingTrade, execution);
      } else {
        // Create new trade record for missing execution
        await this.createMissingTradeRecord(execution);
      }
    } catch (error) {
      console.error(`Error reconciling execution ${execution.tradeId}:`, error);
    }
  }

  private findMatchingLocalTrade(execution: BybitTransactionRecord, localTrades: any[]): any | null {
    // Try to match by order ID first
    let match = localTrades.find(trade => 
      trade.bybit_order_id === execution.orderId
    );

    if (match) return match;

    // Try to match by symbol, side, and approximate time/quantity
    const executionTime = new Date(parseInt(execution.execTime));
    const timeWindow = 10 * 60 * 1000; // 10 minutes

    match = localTrades.find(trade => {
      const tradeTime = new Date(trade.created_at);
      const timeDiff = Math.abs(executionTime.getTime() - tradeTime.getTime());
      
      return (
        trade.symbol === execution.symbol &&
        trade.side.toLowerCase() === execution.side.toLowerCase() &&
        timeDiff <= timeWindow &&
        Math.abs(parseFloat(execution.execQty) - trade.quantity) < 0.001
      );
    });

    return match || null;
  }

  private async updateExistingTrade(localTrade: any, execution: BybitTransactionRecord): Promise<void> {
    try {
      const updates: any = {
        updated_at: new Date().toISOString()
      };

      // Update with actual execution details
      const executionPrice = parseFloat(execution.execPrice);
      const executionQuantity = parseFloat(execution.execQty);

      if (Math.abs(executionPrice - localTrade.price) > 0.01) {
        updates.price = executionPrice;
      }

      if (Math.abs(executionQuantity - localTrade.quantity) > 0.001) {
        updates.quantity = executionQuantity;
      }

      // Ensure status is accurate
      if (localTrade.status === 'pending') {
        updates.status = 'filled';
      }

      // Store Bybit trade ID for reference
      if (!localTrade.bybit_trade_id) {
        updates.bybit_trade_id = execution.tradeId;
      }

      if (Object.keys(updates).length > 1) { // More than just updated_at
        const { error } = await supabase
          .from('trades')
          .update(updates)
          .eq('id', localTrade.id);

        if (error) {
          console.error(`Error updating trade ${localTrade.id}:`, error);
        } else {
          console.log(`✅ Updated trade ${localTrade.id} with Bybit execution data`);
          await this.logger.log('trade_filled', `Trade updated with Bybit execution data`, {
            tradeId: localTrade.id,
            symbol: execution.symbol,
            bybitTradeId: execution.tradeId,
            updates
          });
        }
      }
    } catch (error) {
      console.error(`Error updating existing trade:`, error);
    }
  }

  private async createMissingTradeRecord(execution: BybitTransactionRecord): Promise<void> {
    try {
      console.log(`📝 Creating missing trade record for Bybit execution ${execution.tradeId}`);

      const tradeData = {
        user_id: this.userId,
        symbol: execution.symbol,
        side: execution.side.toLowerCase(),
        order_type: 'market', // Assume market order for executed trades
        price: parseFloat(execution.execPrice),
        quantity: parseFloat(execution.execQty),
        status: 'filled',
        bybit_order_id: execution.orderId,
        bybit_trade_id: execution.tradeId,
        created_at: new Date(parseInt(execution.execTime)).toISOString()
      };

      const { data: newTrade, error } = await supabase
        .from('trades')
        .insert(tradeData)
        .select()
        .single();

      if (error) {
        console.error('Error creating missing trade record:', error);
      } else {
        console.log(`✅ Created missing trade record: ${newTrade.id}`);
        await this.logger.log('trade_executed', `Missing trade record created from Bybit history`, {
          tradeId: newTrade.id,
          symbol: execution.symbol,
          bybitTradeId: execution.tradeId,
          source: 'bybit_reconciliation'
        });
      }
    } catch (error) {
      console.error('Error creating missing trade record:', error);
    }
  }

  private async identifyMissingLocalRecords(
    bybitExecutions: BybitTransactionRecord[], 
    localTrades: any[]
  ): Promise<void> {
    console.log('🔍 Identifying missing local records...');
    
    let missingCount = 0;
    
    for (const execution of bybitExecutions) {
      const hasLocal = this.findMatchingLocalTrade(execution, localTrades);
      if (!hasLocal) {
        missingCount++;
        console.log(`⚠️ Missing local record for Bybit trade: ${execution.symbol} ${execution.side} ${execution.execQty} @ ${execution.execPrice}`);
      }
    }

    if (missingCount > 0) {
      await this.logger.log('system_info', `Found ${missingCount} missing local trade records`, {
        missingCount,
        totalBybitExecutions: bybitExecutions.length
      });
    }
  }

  async performStartupReconciliation(): Promise<void> {
    console.log('🚀 Performing startup reconciliation with Bybit...');
    
    // Look back further on startup to catch any missed trades
    await this.reconcileWithBybitHistory(72); // 72 hours lookback
    
    console.log('✅ Startup reconciliation completed');
  }
}
