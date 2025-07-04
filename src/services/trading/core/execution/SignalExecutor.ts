import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from '../TradingLogger';
import { ServiceContainer } from '../ServiceContainer';
import { TradeValidator } from '../TradeValidator';
import { CredentialsManager } from '../../credentialsManager';

export interface SingleSignalExecutionResult {
  success: boolean;
  error?: string;
}

/**
 * PHASE 2 CONSOLIDATED: SignalExecutor using ServiceContainer pattern
 */
export class SignalExecutor {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = ServiceContainer.getLogger(userId);
  }

  async executeSingleSignal(signal: any, config: TradingConfigData): Promise<SingleSignalExecutionResult> {
    try {
      console.log(`🔍 Processing signal for ${signal.symbol}: ${signal.signal_type} at $${parseFloat(signal.price).toFixed(6)}`);

      // CRITICAL: Validate position limits using ServiceContainer
      console.log(`🔍 CRITICAL VALIDATION: Checking position limits for ${signal.symbol}...`);
      console.log(`📊 Config limits - Max active pairs: ${config.max_active_pairs}, Max positions per pair: ${config.max_positions_per_pair}`);
      
      const positionValidator = ServiceContainer.getPositionValidator(this.userId);
      const positionValidation = await positionValidator.validateWithDetailedLogging(signal.symbol, config);
      console.log(`📋 Position validation result for ${signal.symbol}:`, positionValidation);
      
      if (!positionValidation.isValid) {
        console.error(`❌ POSITION LIMITS EXCEEDED for ${signal.symbol}: ${positionValidation.reason}`);
        console.error(`🚨 BLOCKING EXECUTION: Current positions: ${positionValidation.currentPositions}/${positionValidation.limits.maxPositionsPerPair}, Active pairs: ${positionValidation.activePairs}/${positionValidation.limits.maxActivePairs}`);
        throw new Error(`POSITION LIMITS EXCEEDED: ${positionValidation.reason}`);
      }
      
      console.log(`✅ POSITION LIMITS CHECK PASSED for ${signal.symbol}: ${positionValidation.currentPositions}/${positionValidation.limits.maxPositionsPerPair} positions, ${positionValidation.activePairs}/${positionValidation.limits.maxActivePairs} pairs`);

      // Calculate trade parameters
      const signalPrice = parseFloat(signal.price.toString());
      const entryOffsetPercent = Math.max(config.entry_offset_percent || 0.5, 0.5);
      const takeProfitPercent = config.take_profit_percent || 1.0;

      // FIXED: Calculate entry price properly (signal price should already include offset)
      const entryPrice = signalPrice; // Signal price is already calculated with offset
      const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);

      console.log(`💰 Price calculations for ${signal.symbol}:
        - Signal Price: $${signalPrice.toFixed(6)}
        - Entry Price: $${entryPrice.toFixed(6)} (+${entryOffsetPercent}%)
        - Take Profit: $${takeProfitPrice.toFixed(6)} (+${takeProfitPercent}%)`);

      // Calculate optimal quantity using FIXED validation logic
      const optimalQuantity = await TradeValidator.calculateOptimalQuantity(
        signal.symbol,
        config.max_order_amount_usd,
        entryPrice
      );

      console.log(`🧮 Calculated optimal quantity for ${signal.symbol}: ${optimalQuantity}`);

      // FIXED: Validate trade with corrected logic
      const validation = await TradeValidator.validateTrade(
        signal.symbol,
        optimalQuantity,
        entryPrice,
        config.max_order_amount_usd
      );

      if (!validation.isValid) {
        throw new Error(validation.error || 'Trade validation failed');
      }

      console.log(`✅ ${signal.symbol}: All validations passed, proceeding to order execution`);

      // Execute the trade using OrderExecution
      const credentialsManager = new CredentialsManager(this.userId);
      const bybitService = await credentialsManager.fetchCredentials();
      
      if (!bybitService) {
        throw new Error('Failed to initialize Bybit service');
      }

      const orderExecution = ServiceContainer.getOrderExecution(this.userId, bybitService);
      
      // Execute buy order
      const buyResult = await orderExecution.executeBuyOrder(
        signal.symbol,
        parseFloat(validation.formattedQuantity),
        parseFloat(validation.formattedPrice)
      );

      if (!buyResult.success) {
        throw new Error(`Buy order execution failed: ${buyResult.error}`);
      }

      console.log(`✅ ${signal.symbol}: Buy order executed successfully - Order ID: ${buyResult.orderId}`);

      // Execute sell order (take profit)
      const sellResult = await orderExecution.executeSellOrder(
        signal.symbol,
        parseFloat(validation.formattedQuantity),
        takeProfitPrice
      );

      if (sellResult.success) {
        console.log(`✅ ${signal.symbol}: Take profit order placed - Order ID: ${sellResult.orderId}`);
      } else {
        console.warn(`⚠️ ${signal.symbol}: Take profit order failed: ${sellResult.error}`);
      }

      await this.logger.logSuccess(`Signal processed successfully for ${signal.symbol}`, {
        signalId: signal.id,
        symbol: signal.symbol,
        entryPrice,
        quantity: optimalQuantity,
        buyOrderId: buyResult.orderId,
        sellOrderId: sellResult.orderId
      });

      return { success: true };

    } catch (error) {
      console.error(`❌ Signal processing failed for ${signal.symbol}:`, error);
      await this.logger.logError(`Signal processing failed for ${signal.symbol}`, error, {
        signalId: signal.id
      });
      return { success: false, error: error.message };
    }
  }
}