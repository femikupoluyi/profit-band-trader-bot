
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from '../TradingLogger';
import { ServiceContainer } from '../ServiceContainer';
import { PositionValidator } from '../PositionValidator';
import { TradeValidator } from '../TradeValidator';
import { OrderExecution } from '../OrderExecution';
import { BybitService } from '@/services/bybitService';
import { CredentialsManager } from '../../credentialsManager';

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
  private positionValidator: PositionValidator;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = ServiceContainer.getLogger(userId);
    this.positionValidator = new PositionValidator(userId);
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
        const result = await this.processSingleSignal(signal);
        
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
        await this.markSignalAsProcessed(signal.id);

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
        await this.markSignalAsProcessed(signal.id);
      }
    }

    console.log(`\n📊 ===== SIGNAL PROCESSING COMPLETE =====`);
    console.log(`✅ Successful: ${results.success}`);
    console.log(`❌ Failed: ${results.failed}`);

    return results;
  }

  private async processSingleSignal(signal: any): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔍 Processing signal for ${signal.symbol}: ${signal.signal_type} at $${parseFloat(signal.price).toFixed(6)}`);

      // Load configuration
      const configService = ServiceContainer.getConfigurationService(this.userId);
      const config = await configService.loadUserConfig();
      
      if (!config) {
        throw new Error('Failed to load trading configuration');
      }

      console.log(`🔧 Loading configuration for user: ${this.userId}`);
      console.log(`✅ Configuration loaded successfully: ${JSON.stringify({
        isActive: config.is_active,
        tradingPairs: config.trading_pairs.length,
        maxOrderAmount: config.max_order_amount_usd,
        maxPositionsPerPair: config.max_positions_per_pair
      }, null, 2)}`);

      if (!config.is_active) {
        throw new Error('Trading configuration is not active');
      }

      // Validate position limits
      const positionValidation = await this.positionValidator.validateWithDetailedLogging(signal.symbol, config);
      if (!positionValidation.isValid) {
        throw new Error(positionValidation.reason || 'Position validation failed');
      }

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
      } else {
        console.log(`✅ Signal ${signalId} marked as processed`);
      }
    } catch (error) {
      console.error(`❌ Critical error marking signal ${signalId} as processed:`, error);
    }
  }
}
