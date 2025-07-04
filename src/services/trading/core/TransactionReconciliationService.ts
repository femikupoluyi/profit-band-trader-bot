import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { BybitOrderFetcher, BybitTransactionRecord } from './reconciliation/BybitOrderFetcher';
import { TradeReconciler } from './reconciliation/TradeReconciler';

export class TransactionReconciliationService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private orderFetcher: BybitOrderFetcher;
  private tradeReconciler: TradeReconciler;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.orderFetcher = new BybitOrderFetcher(bybitService, this.logger);
    this.tradeReconciler = new TradeReconciler(userId, this.logger);
  }

  async reconcileWithBybitHistory(lookbackHours: number = 24): Promise<void> {
    try {
      console.log('🔄 Starting transaction reconciliation with Bybit...');
      await this.logger.logSuccess('Starting transaction reconciliation');

      // Get recent execution history from Bybit
      const bybitExecutions = await this.orderFetcher.getBybitExecutionHistory(lookbackHours);
      
      if (!bybitExecutions || bybitExecutions.length === 0) {
        console.log('📭 No recent executions found on Bybit');
        return;
      }

      console.log(`📊 Found ${bybitExecutions.length} executions on Bybit to reconcile`);

      // Get our local trades for comparison
      const localTrades = await this.tradeReconciler.getLocalTrades(lookbackHours);
      
      // Reconcile each Bybit execution
      for (const execution of bybitExecutions) {
        await this.reconcileSingleExecution(execution, localTrades);
      }

      // Check for missing local records
      await this.tradeReconciler.identifyMissingLocalRecords(bybitExecutions, localTrades);

      console.log('✅ Transaction reconciliation completed');
      await this.logger.logSuccess('Transaction reconciliation completed');

    } catch (error) {
      console.error('❌ Error during transaction reconciliation:', error);
      await this.logger.logError('Transaction reconciliation failed', error);
    }
  }


  private async reconcileSingleExecution(
    execution: BybitTransactionRecord, 
    localTrades: any[]
  ): Promise<void> {
    try {
      // Try to find matching local trade
      const matchingTrade = this.tradeReconciler.findMatchingLocalTrade(execution, localTrades);
      
      if (matchingTrade) {
        // Update existing trade with Bybit execution details
        await this.tradeReconciler.updateExistingTrade(matchingTrade, execution);
      } else {
        // Create new trade record for missing execution
        await this.tradeReconciler.createMissingTradeRecord(execution);
      }
    } catch (error) {
      console.error(`Error reconciling execution ${execution.tradeId}:`, error);
    }
  }


  async performStartupReconciliation(): Promise<void> {
    console.log('🚀 Performing startup reconciliation with Bybit...');
    
    // Look back further on startup to catch any missed trades
    await this.reconcileWithBybitHistory(72); // 72 hours lookback
    
    console.log('✅ Startup reconciliation completed');
  }
}
