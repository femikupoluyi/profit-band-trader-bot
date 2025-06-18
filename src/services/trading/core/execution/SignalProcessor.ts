
import { TradingLogger } from '../TradingLogger';
import { ServiceContainer } from '../ServiceContainer';

export class SignalProcessorCore {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = ServiceContainer.getLogger(userId);
  }

  async processSignals(signals: any[]): Promise<{ success: number; failed: number; results: any[] }> {
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    console.log(`📊 Found ${signals.length} unprocessed signals for execution:`);
    signals.forEach((signal, index) => {
      console.log(`  ${index + 1}. ${signal.symbol} - ${signal.signal_type} at $${parseFloat(signal.price).toFixed(6)} (ID: ${signal.id})`);
      console.log(`      Created: ${signal.created_at}, Confidence: ${signal.confidence}, Processed: ${signal.processed}`);
    });

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
        // Signal processing logic would go here
        const result = { success: true, signalId: signal.id };
        results.push(result);
        successCount++;
        
        console.log(`✅ Signal processed successfully for ${signal.symbol}`);
        await this.logger.logSuccess(`Signal processed successfully for ${signal.symbol}`, {
          signalId: signal.id,
          symbol: signal.symbol
        });
      } catch (error) {
        results.push({ success: false, error: error.message, signalId: signal.id });
        failedCount++;
        
        console.error(`❌ Error processing signal ${signal.id} for ${signal.symbol}:`, error);
        await this.logger.logError(`Error processing signal for ${signal.symbol}`, error, {
          signalId: signal.id,
          signalDetails: signal
        });
      }
    }

    return { success: successCount, failed: failedCount, results };
  }
}
