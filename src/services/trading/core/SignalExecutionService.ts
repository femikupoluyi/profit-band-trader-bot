
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
      await this.logger.logSystemInfo('Starting signal execution');

      // Get unprocessed signals
      const signals = await this.getUnprocessedSignals();
      
      if (signals.length === 0) {
        console.log('📭 No unprocessed signals found');
        return;
      }

      console.log(`📊 Processing ${signals.length} unprocessed signals`);

      // Process each signal
      for (const signal of signals) {
        const result = await this.processSingleSignal(signal, config);
        
        if (result.success) {
          console.log(`✅ Signal processed successfully for ${signal.symbol}`);
        } else {
          console.log(`❌ Signal processing failed for ${signal.symbol}: ${result.reason}`);
          await this.logger.logSignalRejected(signal.symbol, result.reason || 'Unknown error');
        }
      }

      console.log('✅ ===== SIGNAL EXECUTION COMPLETE =====\n');
    } catch (error) {
      console.error('❌ Error in signal execution:', error);
      await this.logger.logError('Signal execution failed', error);
      throw error;
    }
  }

  private async processSingleSignal(signal: any, config: TradingConfigData): Promise<SignalProcessingResult> {
    try {
      console.log(`🔍 Processing signal for ${signal.symbol}: ${signal.signal_type}`);

      // Validate the signal
      const validationResult = await this.validationService.validateSignal(signal, config);
      if (!validationResult.isValid) {
        await this.markSignalAsProcessed(signal.id);
        return { success: false, reason: validationResult.reason };
      }

      // Calculate order parameters
      const quantity = validationResult.calculatedData!.quantity;
      const entryPrice = validationResult.calculatedData!.entryPrice;
      const takeProfitPrice = validationResult.calculatedData!.takeProfitPrice;

      // Place the order using the correct method name
      await this.orderPlacer.placeRealBybitOrder(signal, quantity, entryPrice, takeProfitPrice);

      // Mark signal as processed
      await this.markSignalAsProcessed(signal.id);
      
      await this.logger.logSignalProcessed(signal.symbol, signal.signal_type, {
        quantity,
        entryPrice,
        takeProfitPrice,
        calculatedData: validationResult.calculatedData
      });
      
      return { success: true };

    } catch (error) {
      console.error(`❌ Error processing signal for ${signal.symbol}:`, error);
      await this.logger.logError(`Error processing signal for ${signal.symbol}`, error);
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
      }
    } catch (error) {
      console.error(`❌ Database error marking signal ${signalId} as processed:`, error);
      await this.logger.logError('Database error marking signal as processed', error, { signalId });
    }
  }
}
