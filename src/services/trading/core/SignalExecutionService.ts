
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { SignalValidationService } from './SignalValidationService';
import { OrderPlacer } from './OrderPlacer';
import { supabase } from '@/integrations/supabase/client';

interface SignalProcessingResult {
  success: boolean;
  reason?: string;
}

export class SignalExecutionService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private validationService: SignalValidationService;
  private orderPlacer: OrderPlacer;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.validationService = new SignalValidationService(userId);
    this.orderPlacer = new OrderPlacer(userId, bybitService);
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
      const signals = await this.getUnprocessedSignals();
      
      if (signals.length === 0) {
        console.log('📭 No unprocessed signals found');
        await this.logger.logSystemInfo('No unprocessed signals found for execution');
        return;
      }

      console.log(`📊 Found ${signals.length} unprocessed signals:`);
      signals.forEach((signal, index) => {
        console.log(`  ${index + 1}. ${signal.symbol} - ${signal.signal_type} at $${parseFloat(signal.price).toFixed(6)} (ID: ${signal.id}, Created: ${signal.created_at})`);
      });

      let executionResults = {
        total: signals.length,
        successful: 0,
        failed: 0,
        failureReasons: {} as Record<string, number>
      };

      // Process each signal
      for (const signal of signals) {
        console.log(`\n🎯 ===== PROCESSING SIGNAL ${signal.id} FOR ${signal.symbol} =====`);
        const result = await this.processSingleSignal(signal, config);
        
        if (result.success) {
          executionResults.successful++;
          console.log(`✅ Signal processed successfully for ${signal.symbol}`);
        } else {
          executionResults.failed++;
          const reason = result.reason || 'Unknown error';
          executionResults.failureReasons[reason] = (executionResults.failureReasons[reason] || 0) + 1;
          console.log(`❌ Signal processing failed for ${signal.symbol}: ${reason}`);
          await this.logger.logSignalRejected(signal.symbol, reason);
        }
      }

      console.log('\n📊 ===== SIGNAL EXECUTION SUMMARY =====');
      console.log('📈 Execution Results:', executionResults);
      console.log('📋 Failure Breakdown:', executionResults.failureReasons);
      
      await this.logger.logSystemInfo('Signal execution completed', executionResults);
      console.log('✅ ===== SIGNAL EXECUTION COMPLETE =====\n');
    } catch (error) {
      console.error('❌ Error in signal execution:', error);
      await this.logger.logError('Signal execution failed', error);
      throw error;
    }
  }

  private async processSingleSignal(signal: any, config: TradingConfigData): Promise<SignalProcessingResult> {
    try {
      console.log(`🔍 Processing signal for ${signal.symbol}: ${signal.signal_type} at $${parseFloat(signal.price).toFixed(6)}`);

      // Step 1: Validate the signal
      console.log(`📋 Step 1: Validating signal for ${signal.symbol}...`);
      const validationResult = await this.validationService.validateSignal(signal, config);
      if (!validationResult.isValid) {
        console.log(`❌ ${signal.symbol}: Validation failed - ${validationResult.reason}`);
        await this.markSignalAsProcessed(signal.id);
        return { success: false, reason: validationResult.reason };
      }
      console.log(`✅ ${signal.symbol}: Signal validation passed`);

      // Step 2: Extract calculated parameters
      const quantity = validationResult.calculatedData!.quantity;
      const entryPrice = validationResult.calculatedData!.entryPrice;
      const takeProfitPrice = validationResult.calculatedData!.takeProfitPrice;

      console.log(`📊 ${signal.symbol}: Order parameters for execution:
        - Quantity: ${quantity.toFixed(6)}
        - Entry Price: $${entryPrice.toFixed(6)}
        - Take Profit: $${takeProfitPrice.toFixed(6)}
        - Order Value: $${(quantity * entryPrice).toFixed(2)}`);

      // Step 3: Place the order using the correct method name
      console.log(`📝 Step 3: Placing order for ${signal.symbol}...`);
      await this.orderPlacer.placeRealBybitOrder(signal, quantity, entryPrice, takeProfitPrice);
      console.log(`✅ ${signal.symbol}: Order placed successfully`);

      // Step 4: Mark signal as processed
      console.log(`📋 Step 4: Marking signal as processed...`);
      await this.markSignalAsProcessed(signal.id);
      console.log(`✅ ${signal.symbol}: Signal marked as processed`);
      
      await this.logger.logSignalProcessed(signal.symbol, signal.signal_type, {
        signalId: signal.id,
        quantity,
        entryPrice,
        takeProfitPrice,
        calculatedData: validationResult.calculatedData
      });
      
      return { success: true };

    } catch (error) {
      console.error(`❌ Error processing signal for ${signal.symbol}:`, error);
      await this.logger.logError(`Error processing signal for ${signal.symbol}`, error, {
        signalId: signal.id,
        signalDetails: signal
      });
      await this.markSignalAsProcessed(signal.id);
      return { success: false, reason: error.message };
    }
  }

  private async getUnprocessedSignals(): Promise<any[]> {
    try {
      const { data: signals, error } = await supabase
        .from('trading_signals')
        .select('*')
        .eq('user_id', this.userId)
        .eq('processed', false)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error fetching signals:', error);
        await this.logger.logError('Error fetching unprocessed signals', error);
        return [];
      }

      console.log(`📋 Database query returned ${signals?.length || 0} unprocessed signals`);
      return signals || [];
    } catch (error) {
      console.error('❌ Database error fetching signals:', error);
      await this.logger.logError('Database error fetching signals', error);
      return [];
    }
  }

  private async markSignalAsProcessed(signalId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('trading_signals')
        .update({ 
          processed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', signalId);

      if (error) {
        console.error(`❌ Error marking signal ${signalId} as processed:`, error);
        await this.logger.logError(`Error marking signal as processed`, error, { signalId });
      } else {
        console.log(`✅ Signal ${signalId} marked as processed`);
      }
    } catch (error) {
      console.error(`❌ Database error marking signal ${signalId} as processed:`, error);
      await this.logger.logError('Database error marking signal as processed', error, { signalId });
    }
  }
}
