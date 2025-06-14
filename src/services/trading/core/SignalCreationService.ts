
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradeValidator } from './TradeValidator';
import { TradingLogger } from './TradingLogger';
import { SignalAnalysisCore } from './SignalAnalysisCore';

export interface SignalCreationParams {
  symbol: string;
  entryPrice: number;
  confidence: number;
  reasoning: string;
  isAveragingDown: boolean;
}

export class SignalCreationService {
  private userId: string;
  private logger: TradingLogger;
  private signalCore: SignalAnalysisCore;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
    this.signalCore = new SignalAnalysisCore(userId);
  }

  async createSignal(params: SignalCreationParams, config: TradingConfigData): Promise<{ success: boolean; reason?: string }> {
    try {
      // Calculate quantity using proper precision
      const quantity = await TradeValidator.calculateQuantity(
        params.symbol,
        config.max_order_amount_usd || 100,
        params.entryPrice,
        config
      );

      // Validate trade parameters
      const isValid = await TradeValidator.validateTradeParameters(params.symbol, quantity, params.entryPrice, config);
      if (!isValid) {
        console.error(`❌ Trade validation failed for ${params.symbol}`);
        return { success: false, reason: 'Trade validation failed' };
      }

      const orderValue = quantity * params.entryPrice;
      const orderType = params.isAveragingDown ? 'AVERAGING DOWN' : 'NEW POSITION';

      console.log(`✅ Generated ${orderType} signal for ${params.symbol}:`, {
        entryPrice: params.entryPrice,
        quantity: quantity,
        orderValue: orderValue.toFixed(2),
        confidence: params.confidence
      });

      // Store the signal
      const signal = await this.signalCore.storeSignal(
        params.symbol,
        'buy',
        params.entryPrice,
        params.confidence,
        params.reasoning
      );

      console.log(`✅ LIMIT buy signal created successfully for ${params.symbol}:
        - Signal ID: ${signal.id}
        - Order Type: ${orderType} LIMIT
        - Entry Price: ${params.entryPrice}
        - Take Profit: ${config.take_profit_percent}%
        - Confidence: ${params.confidence.toFixed(3)}`);

      await this.logger.logSignalProcessed(params.symbol, 'buy', {
        signalId: signal.id,
        orderType: `${orderType} LIMIT`,
        entryPrice: params.entryPrice,
        takeProfitPercent: config.take_profit_percent,
        confidence: params.confidence,
        reasoning: params.reasoning,
        isAveragingDown: params.isAveragingDown,
        createdAt: signal.created_at
      });

      return { success: true };

    } catch (error) {
      console.error(`❌ Error creating signal for ${params.symbol}:`, error);
      await this.logger.logError(`Failed to create signal for ${params.symbol}`, error, { symbol: params.symbol });
      return { success: false, reason: `Signal creation error: ${error.message}` };
    }
  }
}
