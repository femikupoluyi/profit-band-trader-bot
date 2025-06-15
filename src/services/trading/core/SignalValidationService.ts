
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
      console.log(`🔍 Validating signal for ${signal.symbol}: ${signal.signal_type} at $${parseFloat(signal.price).toFixed(6)}`);

      // Step 1: Basic signal validation
      if (!signal.symbol || !signal.price || !signal.signal_type) {
        return { isValid: false, reason: 'Invalid signal data: missing required fields' };
      }

      if (signal.signal_type !== 'buy') {
        return { isValid: false, reason: `Unsupported signal type: ${signal.signal_type}` };
      }

      // Step 2: CRITICAL - Check position limits FIRST before any calculations
      console.log(`📊 Checking position limits for ${signal.symbol}...`);
      const canOpenPosition = await this.positionValidator.validatePositionLimits(signal.symbol, config);
      if (!canOpenPosition) {
        return { 
          isValid: false, 
          reason: `Position limits exceeded for ${signal.symbol}. Max positions per pair: ${config.max_positions_per_pair}` 
        };
      }

      // Step 3: Calculate entry and take profit prices
      const signalPrice = parseFloat(signal.price);
      const entryPrice = signalPrice * (1 + (config.entry_offset_percent / 100));
      const takeProfitPrice = entryPrice * (1 + (config.take_profit_percent / 100));

      console.log(`💰 Price calculations for ${signal.symbol}:
        - Signal Price: $${signalPrice.toFixed(6)}
        - Entry Price: $${entryPrice.toFixed(6)} (+${config.entry_offset_percent}%)
        - Take Profit: $${takeProfitPrice.toFixed(6)} (+${config.take_profit_percent}%)`);

      // Step 4: Calculate quantity using Bybit precision
      const maxOrderAmount = config.max_order_amount_usd || 100;
      const calculatedQuantity = await TradeValidator.calculateQuantity(signal.symbol, maxOrderAmount, entryPrice, config);
      
      if (calculatedQuantity <= 0) {
        return { isValid: false, reason: `Invalid calculated quantity: ${calculatedQuantity}` };
      }

      // Step 5: Validate trade parameters with Bybit precision
      const isValidTrade = await TradeValidator.validateTradeParameters(signal.symbol, calculatedQuantity, entryPrice, config);
      if (!isValidTrade) {
        return { isValid: false, reason: 'Trade validation failed - order does not meet Bybit requirements' };
      }

      // Step 6: Final order validation using formatted values
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(signal.symbol, entryPrice);
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(signal.symbol, calculatedQuantity);
      
      const finalPrice = parseFloat(formattedPrice);
      const finalQuantity = parseFloat(formattedQuantity);
      const orderValue = finalPrice * finalQuantity;

      const isBybitValid = await BybitPrecisionFormatter.validateOrder(signal.symbol, finalPrice, finalQuantity);
      if (!isBybitValid) {
        return { isValid: false, reason: 'Final Bybit order validation failed' };
      }

      console.log(`✅ Signal validation passed for ${signal.symbol}: Order value $${orderValue.toFixed(2)}`);

      await this.logger.logSuccess(`Signal validation passed for ${signal.symbol}`, {
        signalId: signal.id,
        symbol: signal.symbol,
        entryPrice: finalPrice,
        quantity: finalQuantity,
        orderValue,
        takeProfitPrice
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
      console.error(`❌ Error validating signal for ${signal.symbol}:`, error);
      await this.logger.logError(`Signal validation failed for ${signal.symbol}`, error, {
        signalId: signal.id,
        signal
      });
      return { isValid: false, reason: `Validation error: ${error.message}` };
    }
  }
}
