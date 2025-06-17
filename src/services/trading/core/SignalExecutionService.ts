
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { SignalProcessor } from './SignalProcessor';
import { SignalFetcher } from './SignalFetcher';
import { ExecutionResultsTracker } from './ExecutionResultsTracker';

export class SignalExecutionService {
  private userId: string;
  private logger: TradingLogger;
  private signalProcessor: SignalProcessor;
  private signalFetcher: SignalFetcher;
  private resultsTracker: ExecutionResultsTracker;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
    this.signalProcessor = new SignalProcessor(userId, bybitService);
    this.signalFetcher = new SignalFetcher(userId);
    this.resultsTracker = new ExecutionResultsTracker();
  }

  async executeSignal(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n⚡ ===== SIGNAL EXECUTION START =====');
      console.log('🔧 Execution Configuration:', {
        maxOrderAmount: config.max_order_amount_usd,
        takeProfitPercent: config.take_profit_percent,
        entryOffsetPercent: config.entry_offset_percent,
        maxPositionsPerPair: config.max_positions_per_pair,
        configurationActive: config.is_active
      });
      
      await this.logger.logSystemInfo('Starting signal execution', {
        configSnapshot: {
          maxOrderAmount: config.max_order_amount_usd,
          tradingPairs: config.trading_pairs,
          maxPositionsPerPair: config.max_positions_per_pair,
          isActive: config.is_active
        }
      });

      // ENHANCED: Configuration health check for execution
      if (!config.is_active) {
        console.log('⚠️ Configuration is INACTIVE - skipping signal execution');
        await this.logger.logSystemInfo('Signal execution skipped - configuration inactive');
        return;
      }

      // ENHANCED: Get unprocessed signals with detailed logging
      console.log('📋 Step 1: Fetching unprocessed signals from database...');
      const signals = await this.signalFetcher.getUnprocessedSignals();
      
      console.log(`📊 Database query result: Found ${signals.length} unprocessed signals`);
      
      if (signals.length === 0) {
        console.log('📭 No unprocessed signals found - execution complete');
        await this.logger.logSystemInfo('No unprocessed signals found for execution');
        return;
      }

      console.log(`📊 Found ${signals.length} unprocessed signals for execution:`);
      signals.forEach((signal, index) => {
        console.log(`  ${index + 1}. ${signal.symbol} - ${signal.signal_type} at $${parseFloat(signal.price).toFixed(6)} (ID: ${signal.id})`);
        console.log(`      Created: ${signal.created_at}, Confidence: ${signal.confidence}, Processed: ${signal.processed}`);
      });

      this.resultsTracker.initializeResults(signals.length);

      // ENHANCED: Process each signal with detailed logging
      for (let i = 0; i < signals.length; i++) {
        const signal = signals[i];
        console.log(`\n🎯 ===== PROCESSING SIGNAL ${i + 1}/${signals.length}: ${signal.symbol} =====`);
        console.log(`📊 Signal Details:`, {
          id: signal.id,
          symbol: signal.symbol,
          type: signal.signal_type,
          price: parseFloat(signal.price),
          confidence: signal.confidence,
          reasoning: signal.reasoning,
          created: signal.created_at
        });
        
        try {
          console.log(`⚡ Step 2: Processing signal for ${signal.symbol}...`);
          const result = await this.signalProcessor.processSingleSignal(signal, config);
          
          console.log(`📊 Signal processing result for ${signal.symbol}:`, {
            success: result.success,
            reason: result.reason,
            orderId: result.orderId
          });
          
          if (result.success) {
            this.resultsTracker.recordSuccess();
            console.log(`✅ Signal processed successfully for ${signal.symbol} - Order ID: ${result.orderId}`);
            await this.logger.logSuccess(`Signal processed successfully for ${signal.symbol}`, {
              signalId: signal.id,
              orderId: result.orderId,
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

          // ENHANCED: Mark signal as processed with logging
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

      // ENHANCED: Detailed execution summary
      const executionSummary = this.resultsTracker.getResults();
      console.log('\n📊 ===== SIGNAL EXECUTION SUMMARY =====');
      console.log('📈 Execution Statistics:', executionSummary);
      
      if (executionSummary.failures > 0) {
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
      
      console.log('✅ ===== SIGNAL EXECUTION COMPLETE =====\n');
    } catch (error) {
      console.error('❌ Critical error in signal execution:', error);
      await this.logger.logError('Critical error in signal execution', error);
      throw error;
    }
  }
}
