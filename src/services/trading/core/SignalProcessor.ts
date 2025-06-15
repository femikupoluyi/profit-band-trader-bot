
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';
import { SignalValidationService } from './SignalValidationService';
import { OrderPlacer } from './OrderPlacer';
import { BybitService } from '../../bybitService';

interface SignalProcessingResult {
  success: boolean;
  reason?: string;
}

export class SignalProcessor {
  private userId: string;
  private logger: TradingLogger;
  private validationService: SignalValidationService;
  private orderPlacer: OrderPlacer;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
    this.validationService = new SignalValidationService(userId);
    this.orderPlacer = new OrderPlacer(userId, bybitService);
  }

  async processSingleSignal(signal: any, config: TradingConfigData): Promise<SignalProcessingResult> {
    try {
      console.log(`🔍 Processing signal for ${signal.symbol}: ${signal.signal_type} at $${parseFloat(signal.price).toFixed(6)}`);

      // Step 1: Validate the signal
      console.log(`📋 Step 1: Validating signal for ${signal.symbol}...`);
      const validationResult = await this.validationService.validateSignal(signal, config);
      if (!validationResult.isValid) {
        console.log(`❌ ${signal.symbol}: Validation failed - ${validationResult.reason}`);
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

      // Step 3: Place the order with signal ID for proper tracking
      console.log(`📝 Step 3: Placing order for ${signal.symbol}...`);
      await this.orderPlacer.placeRealBybitOrder(signal, quantity, entryPrice, takeProfitPrice);
      console.log(`✅ ${signal.symbol}: Order placed successfully`);

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
      return { success: false, reason: error.message };
    }
  }
}
