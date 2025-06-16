
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { PositionValidator } from './PositionValidator';
import { TradeValidator } from './TradeValidator';
import { TradingLogger } from './TradingLogger';
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';

export interface SignalValidationResult {
  isValid: boolean;
  reason?: string;
  calculatedData?: {
    quantity: number;
    entryPrice: number;
    takeProfitPrice: number;
    orderValue: number;
  };
}

export class SignalValidationService {
  private userId: string;
  private positionValidator: PositionValidator;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.positionValidator = new PositionValidator(userId);
    this.logger = new TradingLogger(userId);
  }

  async validateSignal(signal: any, config: TradingConfigData): Promise<SignalValidationResult> {
    try {
      console.log(`\n🔍 ===== SIGNAL VALIDATION START FOR ${signal.symbol} =====`);
      console.log(`📊 Signal: ${signal.signal_type} at $${parseFloat(signal.price).toFixed(6)}`);

      // Step 1: Basic signal validation
      if (!signal.symbol || !signal.price || !signal.signal_type) {
        return { isValid: false, reason: 'Invalid signal data: missing required fields' };
      }

      if (signal.signal_type !== 'buy') {
        return { isValid: false, reason: `Unsupported signal type: ${signal.signal_type}` };
      }

      // Step 2: CRITICAL - Position Limits Validation FIRST - BLOCKING CHECK
      console.log(`\n🚨 STEP 2: CRITICAL POSITION LIMITS CHECK FOR ${signal.symbol}`);
      
      const detailedValidation = await this.positionValidator.validateWithDetailedLogging(signal.symbol, config);
      
      if (!detailedValidation.isValid) {
        console.error(`❌ POSITION LIMITS FAILED: ${detailedValidation.reason}`);
        console.error(`📊 Current state: ${detailedValidation.currentPositions} positions, ${detailedValidation.activePairs} active pairs`);
        console.error(`📊 Limits: ${detailedValidation.limits.maxPositionsPerPair} max per pair, ${detailedValidation.limits.maxActivePairs} max active pairs`);
        
        await this.logger.logError(`Position limits exceeded for ${signal.symbol}`, new Error(detailedValidation.reason!), {
          signalId: signal.id,
          currentPositions: detailedValidation.currentPositions,
          activePairs: detailedValidation.activePairs,
          limits: detailedValidation.limits
        });
        
        return { 
          isValid: false, 
          reason: `POSITION LIMITS EXCEEDED: ${detailedValidation.reason}` 
        };
      }

      console.log(`✅ POSITION LIMITS CHECK PASSED for ${signal.symbol}`);
      console.log(`📊 State: ${detailedValidation.currentPositions}/${detailedValidation.limits.maxPositionsPerPair} positions, ${detailedValidation.activePairs}/${detailedValidation.limits.maxActivePairs} pairs`);

      // Step 3: Calculate entry and take profit prices
      console.log(`\n📊 STEP 3: PRICE CALCULATIONS FOR ${signal.symbol}`);
      
      const signalPrice = parseFloat(signal.price);
      const entryPrice = signalPrice * (1 + (config.entry_offset_percent / 100));
      const takeProfitPrice = entryPrice * (1 + (config.take_profit_percent / 100));

      console.log(`💰 Price calculations for ${signal.symbol}:
        - Signal Price: $${signalPrice.toFixed(6)}
        - Entry Price: $${entryPrice.toFixed(6)} (+${config.entry_offset_percent}%)
        - Take Profit: $${takeProfitPrice.toFixed(6)} (+${config.take_profit_percent}%)`);

      // Step 4: Calculate quantity using Bybit precision - CRITICAL PRECISION STEP
      console.log(`\n🔧 STEP 4: QUANTITY CALCULATION WITH BYBIT PRECISION FOR ${signal.symbol}`);
      
      const maxOrderAmount = config.max_order_amount_usd || 100;
      
      // Clear cache to ensure fresh precision data
      BybitPrecisionFormatter.clearCache();
      
      const calculatedQuantity = await TradeValidator.calculateQuantity(signal.symbol, maxOrderAmount, entryPrice, config);
      
      if (calculatedQuantity <= 0) {
        return { isValid: false, reason: `Invalid calculated quantity: ${calculatedQuantity}` };
      }

      console.log(`📊 Calculated quantity for ${signal.symbol}: ${calculatedQuantity}`);

      // Step 5: Validate trade parameters with Bybit precision - CRITICAL VALIDATION
      console.log(`\n🔍 STEP 5: BYBIT PRECISION VALIDATION FOR ${signal.symbol}`);
      
      const isValidTrade = await TradeValidator.validateTradeParameters(signal.symbol, calculatedQuantity, entryPrice, config);
      if (!isValidTrade) {
        return { isValid: false, reason: 'Trade validation failed - order does not meet Bybit requirements' };
      }

      // Step 6: Final formatting and validation - ENSURE PRECISION COMPLIANCE
      console.log(`\n✅ STEP 6: FINAL PRECISION FORMATTING FOR ${signal.symbol}`);
      
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(signal.symbol, entryPrice);
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(signal.symbol, calculatedQuantity);
      
      const finalPrice = parseFloat(formattedPrice);
      const finalQuantity = parseFloat(formattedQuantity);
      const orderValue = finalPrice * finalQuantity;

      console.log(`🔧 Final formatted values for ${signal.symbol}:
        - Price: "${formattedPrice}" (${finalPrice})
        - Quantity: "${formattedQuantity}" (${finalQuantity})
        - Order Value: $${orderValue.toFixed(2)}`);

      // CRITICAL: Final Bybit validation with formatted values
      const isBybitValid = await BybitPrecisionFormatter.validateOrder(signal.symbol, finalPrice, finalQuantity);
      if (!isBybitValid) {
        console.error(`❌ FINAL BYBIT VALIDATION FAILED for ${signal.symbol}`);
        return { isValid: false, reason: 'Final Bybit order validation failed - precision requirements not met' };
      }

      console.log(`✅ ALL VALIDATIONS PASSED for ${signal.symbol}: Order value $${orderValue.toFixed(2)}`);

      await this.logger.logSuccess(`Signal validation passed for ${signal.symbol}`, {
        signalId: signal.id,
        symbol: signal.symbol,
        entryPrice: finalPrice,
        quantity: finalQuantity,
        orderValue,
        takeProfitPrice,
        positionLimits: detailedValidation
      });

      return {
        isValid: true,
        calculatedData: {
          quantity: finalQuantity,
          entryPrice: finalPrice,
          takeProfitPrice,
          orderValue
        }
      };

    } catch (error) {
      console.error(`❌ CRITICAL ERROR validating signal for ${signal.symbol}:`, error);
      await this.logger.logError(`Signal validation failed for ${signal.symbol}`, error, {
        signalId: signal.id,
        signal
      });
      return { isValid: false, reason: `Validation error: ${error.message}` };
    }
  }
}
