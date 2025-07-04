
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from '../TradingLogger';
import { ServiceContainer } from '../ServiceContainer';
import { SignalExecutor } from './SignalExecutor';
import { ConfigValidator } from './ConfigValidator';
import { SignalMarker } from './SignalMarker';

export interface SignalProcessingResult {
  success: number;
  failed: number;
  results: Array<{
    signalId: string;
    symbol: string;
    success: boolean;
    error?: string;
  }>;
}

export class SignalProcessorCore {
  private userId: string;
  private logger: TradingLogger;
  private signalExecutor: SignalExecutor;
  private configValidator: ConfigValidator;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = ServiceContainer.getLogger(userId);
    this.signalExecutor = new SignalExecutor(userId);
    this.configValidator = new ConfigValidator(userId);
  }

  async processSignals(signals: any[]): Promise<SignalProcessingResult> {
    const results: SignalProcessingResult = {
      success: 0,
      failed: 0,
      results: []
    };

    if (!signals || signals.length === 0) {
      console.log('📭 No signals to process');
      return results;
    }

    console.log(`\n🎯 ===== PROCESSING ${signals.length} SIGNALS =====`);

    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i];
      console.log(`\n🎯 ===== PROCESSING SIGNAL ${i + 1}/${signals.length}: ${signal.symbol} =====`);
      console.log(`📊 Signal Details: ${JSON.stringify({
        id: signal.id,
        symbol: signal.symbol,
        type: signal.signal_type,
        price: parseFloat(signal.price.toString()),
        confidence: signal.confidence,
        reasoning: signal.reasoning,
        created: signal.created_at
      }, null, 2)}`);

      try {
        // Load configuration for each signal
        const config = await this.configValidator.loadConfiguration();
        
        const result = await this.signalExecutor.executeSingleSignal(signal, config);
        
        if (result.success) {
          results.success++;
          console.log(`✅ ${signal.symbol}: Signal processed successfully`);
        } else {
          results.failed++;
          console.log(`❌ ${signal.symbol}: Signal processing failed - ${result.error}`);
        }

        results.results.push({
          signalId: signal.id,
          symbol: signal.symbol,
          success: result.success,
          error: result.error
        });

        // Mark signal as processed regardless of outcome
        await SignalMarker.markSignalAsProcessed(signal.id);

      } catch (error) {
        console.error(`❌ Signal processing failed for ${signal.symbol}:`, error);
        results.failed++;
        results.results.push({
          signalId: signal.id,
          symbol: signal.symbol,
          success: false,
          error: error.message
        });

        // Mark as processed even on error to prevent reprocessing
        await SignalMarker.markSignalAsProcessed(signal.id);
      }
    }

    console.log(`\n📊 ===== SIGNAL PROCESSING COMPLETE =====`);
    console.log(`✅ Successful: ${results.success}`);
    console.log(`❌ Failed: ${results.failed}`);

    return results;
  }
}
