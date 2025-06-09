
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { PositionValidator } from './PositionValidator';
import { ConfigurableFormatter } from './ConfigurableFormatter';
import { TradeValidator } from './TradeValidator';
import { TradingPairsService } from './TradingPairsService';
import { TradingLogger } from './TradingLogger';

interface ValidationResult {
  isValid: boolean;
  reason?: string;
  calculatedData?: {
    entryPrice: number;
    finalQuantity: number;
    takeProfitPrice: number;
  };
}

export class SignalValidationService {
  private userId: string;
  private logger: TradingLogger;
  private positionValidator: PositionValidator;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
    this.positionValidator = new PositionValidator(userId);
  }

  async validateSignal(signal: any, config: TradingConfigData): Promise<ValidationResult> {
    try {
      // Check if symbol is configured for trading
      const isPairConfigured = await TradingPairsService.isPairConfiguredForTrading(signal.symbol, this.userId);
      if (!isPairConfigured) {
        return { isValid: false, reason: 'Not configured for trading' };
      }

      // Check position limits
      const canExecute = await this.positionValidator.validatePositionLimits(signal.symbol, config);
      if (!canExecute) {
        return { isValid: false, reason: 'Position limits exceeded' };
      }

      // Calculate and validate order parameters
      const entryPrice = parseFloat(signal.price.toString());
      const adjustedQuantity = TradeValidator.calculateQuantity(signal.symbol, config.max_order_amount_usd, entryPrice, config);
      const formattedQuantityStr = await ConfigurableFormatter.formatQuantity(signal.symbol, adjustedQuantity);
      const finalQuantity = parseFloat(formattedQuantityStr);

      // Validate order with Bybit requirements
      const isValidOrder = await ConfigurableFormatter.validateOrder(signal.symbol, entryPrice, finalQuantity);
      if (!isValidOrder) {
        return { isValid: false, reason: 'Order validation failed' };
      }

      // Calculate take-profit price
      const takeProfitPrice = entryPrice * (1 + config.take_profit_percent / 100);

      return {
        isValid: true,
        calculatedData: {
          entryPrice,
          finalQuantity,
          takeProfitPrice
        }
      };
    } catch (error) {
      await this.logger.logError('Signal validation error', error);
      return { isValid: false, reason: error.message };
    }
  }
}
