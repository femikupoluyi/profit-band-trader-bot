
import { TradingLogger } from '../TradingLogger';
import { ServiceContainer } from '../ServiceContainer';
import { SignalValidationService } from '../SignalValidationService';
import { OrderPlacer } from '../OrderPlacer';
import { BybitService } from '../../../bybitService';
import { CredentialsManager } from '../../credentialsManager';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class SignalProcessorCore {
  private userId: string;
  private logger: TradingLogger;
  private bybitService: BybitService | null = null;
  private validationService: SignalValidationService;
  private orderPlacer: OrderPlacer | null = null;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = ServiceContainer.getLogger(userId);
    this.validationService = new SignalValidationService(userId);
  }

  private async initializeServices(): Promise<void> {
    if (!this.bybitService) {
      const credentialsManager = new CredentialsManager(this.userId);
      this.bybitService = await credentialsManager.fetchCredentials();
      
      if (!this.bybitService) {
        throw new Error('Failed to initialize Bybit service for signal processing');
      }
      
      this.orderPlacer = new OrderPlacer(this.userId, this.bybitService);
    }
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

    // Initialize services if needed
    try {
      await this.initializeServices();
    } catch (error) {
      console.error('❌ Failed to initialize services for signal processing:', error);
      await this.logger.logError('Failed to initialize services for signal processing', error);
      
      // Mark all signals as failed due to initialization failure
      for (const signal of signals) {
        results.push({ success: false, error: 'Service initialization failed', signalId: signal.id });
        failedCount++;
      }
      
      return { success: successCount, failed: failedCount, results };
    }

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
        // Process the signal with proper order placement
        const result = await this.processSingleSignal(signal);
        
        if (result.success) {
          results.push({ success: true, signalId: signal.id, ...result });
          successCount++;
          console.log(`✅ Signal processed successfully for ${signal.symbol}`);
          
          await this.logger.logSuccess(`Signal processed successfully for ${signal.symbol}`, {
            signalId: signal.id,
            symbol: signal.symbol,
            result
          });
        } else {
          results.push({ success: false, error: result.error, signalId: signal.id });
          failedCount++;
          console.error(`❌ Signal processing failed for ${signal.symbol}: ${result.error}`);
          
          await this.logger.logError(`Signal processing failed for ${signal.symbol}`, new Error(result.error!), {
            signalId: signal.id,
            signalDetails: signal
          });
        }
        
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

  private async processSingleSignal(signal: any): Promise<{ success: boolean; error?: string; orderId?: string; tradeId?: string }> {
    try {
      console.log(`🔍 Processing signal for ${signal.symbol}: ${signal.signal_type} at $${parseFloat(signal.price).toFixed(6)}`);

      // Get fresh configuration for validation
      const configService = ServiceContainer.getConfigurationService(this.userId);
      const config = await configService.loadUserConfig();
      
      if (!config) {
        return { success: false, error: 'Could not load trading configuration' };
      }

      // Step 1: Validate the signal
      console.log(`📋 Step 1: Validating signal for ${signal.symbol}...`);
      const validationResult = await this.validationService.validateSignal(signal, config);
      
      if (!validationResult.isValid) {
        console.log(`❌ ${signal.symbol}: Validation failed - ${validationResult.reason}`);
        return { success: false, error: validationResult.reason };
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

      // Step 3: Place the order with signal ID for proper tracking
      console.log(`📝 Step 3: Placing order for ${signal.symbol}...`);
      
      if (!this.orderPlacer) {
        return { success: false, error: 'Order placer not initialized' };
      }
      
      await this.orderPlacer.placeRealBybitOrder(signal, quantity, entryPrice, takeProfitPrice);
      console.log(`✅ ${signal.symbol}: Order placed successfully`);

      // Mark signal as processed
      const signalFetcher = ServiceContainer.getSignalFetcher(this.userId);
      await signalFetcher.markSignalAsProcessed(signal.id);

      await this.logger.logSignalProcessed(signal.symbol, signal.signal_type, {
        signalId: signal.id,
        quantity,
        entryPrice,
        takeProfitPrice,
        calculatedData: validationResult.calculatedData
      });
      
      return { 
        success: true, 
        orderId: 'bybit_order_placed',
        tradeId: 'trade_record_created'
      };

    } catch (error) {
      console.error(`❌ Error processing signal for ${signal.symbol}:`, error);
      return { success: false, error: error.message };
    }
  }
}
