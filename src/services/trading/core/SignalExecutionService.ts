
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { SignalProcessorCore } from './execution/SignalProcessor';
import { SignalFetcher } from './SignalFetcher';
import { ExecutionResultsTracker } from './ExecutionResultsTracker';
import { ServiceContainer } from './ServiceContainer';
import { ExecutionOrchestrator } from './execution/ExecutionOrchestrator';

interface EnhancedSignalProcessingResult {
  success: boolean;
  reason?: string;
  orderId?: string;
}

/**
 * PHASE 2 CONSOLIDATED: SignalExecutionService simplified with ServiceContainer
 */
export class SignalExecutionService {
  private userId: string;
  private logger: TradingLogger;
  private signalProcessor: SignalProcessorCore;
  private signalFetcher: SignalFetcher;
  private resultsTracker: ExecutionResultsTracker;
  private executionOrchestrator: ExecutionOrchestrator;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.logger = ServiceContainer.getLogger(userId);
    this.signalProcessor = new SignalProcessorCore(userId);
    this.signalFetcher = ServiceContainer.getSignalFetcher(userId);
    this.resultsTracker = new ExecutionResultsTracker();
    this.executionOrchestrator = new ExecutionOrchestrator(userId);
  }

  async executeSignal(config: TradingConfigData): Promise<void> {
    try {
      await this.executionOrchestrator.logExecutionStart();
      
      // Validate execution configuration
      const canExecute = await this.executionOrchestrator.validateExecution(config);
      if (!canExecute) {
        return;
      }

      // Get unprocessed signals
      console.log('📋 Step 1: Fetching unprocessed signals from database...');
      const signals = await this.signalFetcher.getUnprocessedSignals();
      
      console.log(`📊 Database query result: Found ${signals.length} unprocessed signals`);
      
      if (signals.length === 0) {
        console.log('📭 No unprocessed signals found - execution complete');
        await this.logger.logSystemInfo('No unprocessed signals found for execution');
        return;
      }

      this.resultsTracker.initializeResults(signals.length);

      // Process each signal with detailed logging
      for (let i = 0; i < signals.length; i++) {
        const signal = signals[i];
        
        try {
          console.log(`⚡ Step 2: Processing signal for ${signal.symbol}...`);
          // Use the core processor to handle signals
          const processingResult = await this.signalProcessor.processSignals([signal]);
          const result = processingResult.results[0] as any;
          
          console.log(`📊 Signal processing result for ${signal.symbol}:`, {
            success: result.success,
            reason: result.reason,
            orderId: result.orderId || 'N/A'
          });
          
          if (result.success) {
            this.resultsTracker.recordSuccess();
            console.log(`✅ Signal processed successfully for ${signal.symbol} - Order ID: ${result.orderId || 'N/A'}`);
            await this.logger.logSuccess(`Signal processed successfully for ${signal.symbol}`, {
              signalId: signal.id,
              orderId: result.orderId || 'N/A',
              symbol: signal.symbol
            });
          } else {
            this.resultsTracker.recordFailure(result.reason!);
            console.log(`❌ Signal processing failed for ${signal.symbol}: ${result.reason}`);
            await this.logger.logSignalRejected(signal.symbol, result.reason!, {
              signalId: signal.id,
              signalDetails: {
                price: parseFloat(signal.price),
                confidence: signal.confidence,
                type: signal.signal_type
              }
            });
          }

          // Mark signal as processed
          console.log(`📋 Step 3: Marking signal ${signal.id} as processed...`);
          await this.signalFetcher.markSignalAsProcessed(signal.id);
          console.log(`✅ ${signal.symbol}: Signal marked as processed in database`);
          
        } catch (error) {
          this.resultsTracker.recordFailure(`Processing error: ${error.message}`);
          console.error(`❌ Error processing signal ${signal.id} for ${signal.symbol}:`, error);
          await this.logger.logError(`Error processing signal for ${signal.symbol}`, error, {
            signalId: signal.id,
            signalDetails: signal
          });
          
          // Still mark as processed to avoid infinite retries
          try {
            await this.signalFetcher.markSignalAsProcessed(signal.id);
            console.log(`⚠️ ${signal.symbol}: Signal marked as processed despite error`);
          } catch (markError) {
            console.error(`❌ Failed to mark signal as processed:`, markError);
          }
        }
      }

      // Log execution summary
      const executionSummary = this.resultsTracker.getResults();
      console.log('\n📊 ===== SIGNAL EXECUTION SUMMARY =====');
      console.log('📈 Execution Statistics:', executionSummary);
      
      if (executionSummary.failed > 0) {
        console.log('❌ Failure Details:', executionSummary.failureReasons);
      }
      
      this.resultsTracker.logSummary();
      
      await this.logger.logSystemInfo('Signal execution completed', {
        ...executionSummary,
        totalSignalsProcessed: signals.length,
        configurationUsed: {
          maxOrderAmount: config.max_order_amount_usd,
          tradingPairs: config.trading_pairs.length
        }
      });
      
      await this.executionOrchestrator.logExecutionComplete();
    } catch (error) {
      console.error('❌ Critical error in signal execution:', error);
      await this.logger.logError('Critical error in signal execution', error);
      throw error;
    }
  }

  async testSignalExecution(config: TradingConfigData): Promise<boolean> {
    try {
      console.log('\n🧪 ===== TESTING SIGNAL EXECUTION PIPELINE =====');
      
      const signals = await this.signalFetcher.getUnprocessedSignals();
      
      if (signals.length === 0) {
        console.log('📭 No test signals found for execution testing');
        return false;
      }

      console.log(`🧪 Testing with ${signals.length} signal(s)`);
      
      const testSignal = signals[0];
      console.log(`🧪 Testing signal execution for ${testSignal.symbol}`);
      
      const processingResult = await this.signalProcessor.processSignals([testSignal]);
      const result = processingResult.results[0] as any;
      
      console.log(`🧪 Test result:`, {
        success: result.success,
        reason: result.reason,
        orderId: result.orderId || 'N/A'
      });
      
      await this.signalFetcher.markSignalAsProcessed(testSignal.id);
      
      return result.success;
    } catch (error) {
      console.error('❌ Error testing signal execution:', error);
      return false;
    }
  }
}
