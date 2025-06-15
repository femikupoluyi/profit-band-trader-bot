
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
        maxPositionsPerPair: config.max_positions_per_pair
      });
      
      await this.logger.logSystemInfo('Starting signal execution', {
        configSnapshot: {
          maxOrderAmount: config.max_order_amount_usd,
          tradingPairs: config.trading_pairs,
          maxPositionsPerPair: config.max_positions_per_pair
        }
      });

      // Get unprocessed signals
      console.log('📋 Fetching unprocessed signals...');
      const signals = await this.signalFetcher.getUnprocessedSignals();
      
      if (signals.length === 0) {
        console.log('📭 No unprocessed signals found');
        await this.logger.logSystemInfo('No unprocessed signals found for execution');
        return;
      }

      console.log(`📊 Found ${signals.length} unprocessed signals:`);
      signals.forEach((signal, index) => {
        console.log(`  ${index + 1}. ${signal.symbol} - ${signal.signal_type} at $${parseFloat(signal.price).toFixed(6)} (ID: ${signal.id}, Created: ${signal.created_at})`);
      });

      this.resultsTracker.initializeResults(signals.length);

      // Process each signal
      for (const signal of signals) {
        console.log(`\n🎯 ===== PROCESSING SIGNAL ${signal.id} FOR ${signal.symbol} =====`);
        const result = await this.signalProcessor.processSingleSignal(signal, config);
        
        if (result.success) {
          this.resultsTracker.recordSuccess();
          console.log(`✅ Signal processed successfully for ${signal.symbol}`);
        } else {
          this.resultsTracker.recordFailure(result.reason!);
          console.log(`❌ Signal processing failed for ${signal.symbol}: ${result.reason}`);
          await this.logger.logSignalRejected(signal.symbol, result.reason!);
        }

        // Mark signal as processed regardless of success/failure
        console.log(`📋 Step 4: Marking signal as processed...`);
        await this.signalFetcher.markSignalAsProcessed(signal.id);
        console.log(`✅ ${signal.symbol}: Signal marked as processed`);
      }

      this.resultsTracker.logSummary();
      
      await this.logger.logSystemInfo('Signal execution completed', this.resultsTracker.getResults());
      console.log('✅ ===== SIGNAL EXECUTION COMPLETE =====\n');
    } catch (error) {
      console.error('❌ Error in signal execution:', error);
      await this.logger.logError('Signal execution failed', error);
      throw error;
    }
  }
}
