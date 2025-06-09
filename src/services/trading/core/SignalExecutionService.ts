
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { PositionValidator } from './PositionValidator';
import { OrderPlacer } from './OrderPlacer';
import { TradeValidator } from './TradeValidator';
import { ConfigurableFormatter } from './ConfigurableFormatter';
import { TradingLogger } from './TradingLogger';
import { TradingPairsService } from './TradingPairsService';

export class SignalExecutionService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private positionValidator: PositionValidator;
  private orderPlacer: OrderPlacer;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.bybitService.setLogger(this.logger);
    this.positionValidator = new PositionValidator(userId);
    this.orderPlacer = new OrderPlacer(userId, bybitService);
  }

  async executeSignal(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n⚡ ===== SIGNAL EXECUTION START =====');
      await this.logger.logSuccess('Starting signal execution phase');
      
      // Load configured trading pairs from user config
      const configuredPairs = await TradingPairsService.getConfiguredTradingPairs(this.userId);
      console.log(`📊 User has configured ${configuredPairs.length} trading pairs:`, configuredPairs);
      
      // Preload instrument info for configured trading pairs
      if (configuredPairs && configuredPairs.length > 0) {
        console.log(`🔄 Preloading instrument info for ${configuredPairs.length} configured trading pairs...`);
        await ConfigurableFormatter.preloadInstrumentInfo(configuredPairs);
      }
      
      // Get unprocessed signals
      console.log('🔍 Fetching unprocessed signals...');
      const { data: signals, error } = await supabase
        .from('trading_signals')
        .select('*')
        .eq('user_id', this.userId)
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) {
        console.error('❌ Error fetching signals:', error);
        await this.logger.logError('Error fetching signals', error);
        return;
      }

      if (!signals || signals.length === 0) {
        console.log('📭 No unprocessed signals found');
        await this.logger.logSystemInfo('No unprocessed signals found');
        return;
      }

      console.log(`📊 Found ${signals.length} unprocessed signals:`);
      signals.forEach((signal, index) => {
        console.log(`  ${index + 1}. ${signal.symbol} - ${signal.signal_type} at $${signal.price} (ID: ${signal.id}, Created: ${new Date(signal.created_at).toLocaleString()})`);
      });

      await this.logger.logSuccess(`Found ${signals.length} unprocessed signals`, {
        signalCount: signals.length,
        signals: signals.map(s => ({
          id: s.id,
          symbol: s.symbol,
          type: s.signal_type,
          price: s.price,
          created: s.created_at
        }))
      });

      let executionResults = {
        total: signals.length,
        executed: 0,
        rejected: 0,
        errors: 0
      };

      for (const signal of signals) {
        try {
          const result = await this.processSingleSignal(signal, config);
          if (result.success) {
            executionResults.executed++;
          } else {
            executionResults.rejected++;
          }
        } catch (error) {
          executionResults.errors++;
          console.error(`❌ Error processing signal ${signal.id}:`, error);
        }
      }
      
      console.log('📊 ===== SIGNAL EXECUTION SUMMARY =====', executionResults);
      await this.logger.logSuccess('Signal execution completed', executionResults);
    } catch (error) {
      console.error(`❌ Error executing signals:`, error);
      await this.logger.logError('Error executing signals', error);
    }
  }

  private async processSingleSignal(signal: any, config: TradingConfigData): Promise<{ success: boolean; reason?: string }> {
    try {
      console.log(`\n⚡ ===== PROCESSING SIGNAL ${signal.id} FOR ${signal.symbol} =====`);
      await this.logger.logSystemInfo(`Processing signal ${signal.id} for ${signal.symbol}`, {
        signalId: signal.id,
        symbol: signal.symbol,
        type: signal.signal_type,
        price: signal.price,
        confidence: signal.confidence
      });
      
      // Step 1: Check if symbol is configured for trading
      console.log(`🔍 Checking if ${signal.symbol} is configured for trading...`);
      const isPairConfigured = await TradingPairsService.isPairConfiguredForTrading(signal.symbol, this.userId);
      
      if (!isPairConfigured) {
        console.log(`❌ Signal for ${signal.symbol} rejected: not configured for trading`);
        await this.markSignalRejected(signal.id, `Symbol ${signal.symbol} not configured for trading`);
        return { success: false, reason: 'Not configured for trading' };
      }
      
      console.log(`✅ ${signal.symbol} is configured for trading`);

      // Step 2: Check position limits BEFORE executing signal
      console.log(`🔍 Validating position limits for ${signal.symbol}...`);
      const canExecute = await this.positionValidator.validatePositionLimits(signal.symbol, config);
      if (!canExecute) {
        console.log(`❌ Position limits exceeded for ${signal.symbol}, rejecting signal`);
        await this.markSignalRejected(signal.id, 'Position limits exceeded');
        return { success: false, reason: 'Position limits exceeded' };
      }
      
      console.log(`✅ Position limits validation passed for ${signal.symbol}`);
      
      const entryPrice = parseFloat(signal.price.toString());
      
      // Step 3: Calculate quantity with proper formatting
      console.log(`🔢 Calculating quantity for ${signal.symbol}...`);
      const adjustedQuantity = TradeValidator.calculateQuantity(signal.symbol, config.max_order_amount_usd, entryPrice, config);
      
      // Use async formatting for precise Bybit compliance
      const formattedQuantityStr = await ConfigurableFormatter.formatQuantity(signal.symbol, adjustedQuantity);
      const finalQuantity = parseFloat(formattedQuantityStr);
      
      console.log(`📊 ${signal.symbol} quantity calculation:
        - Max Order Amount: $${config.max_order_amount_usd}
        - Entry Price: $${entryPrice.toFixed(6)}
        - Raw Quantity: ${adjustedQuantity}
        - Formatted Quantity: ${finalQuantity}`);
      
      // Step 4: Validate trade parameters with Bybit instrument requirements
      console.log(`🔧 Validating order parameters for ${signal.symbol}...`);
      const isValidOrder = await ConfigurableFormatter.validateOrder(signal.symbol, entryPrice, finalQuantity);
      if (!isValidOrder) {
        await this.markSignalRejected(signal.id, 'Order validation failed (Bybit requirements)');
        return { success: false, reason: 'Order validation failed' };
      }

      console.log(`✅ Order validation passed for ${signal.symbol}`);

      // Step 5: Calculate take-profit price
      const takeProfitPrice = entryPrice * (1 + config.take_profit_percent / 100);
      
      console.log(`🎯 ${signal.symbol} order details:
        - Entry Price: $${entryPrice.toFixed(6)}
        - Take Profit: $${takeProfitPrice.toFixed(6)} (+${config.take_profit_percent}%)
        - Quantity: ${finalQuantity}`);

      // Step 6: Place REAL limit buy order on Bybit
      console.log(`📝 Placing real Bybit order for ${signal.symbol}...`);
      const orderResult = await this.orderPlacer.placeRealBybitOrder(signal, finalQuantity, entryPrice, takeProfitPrice);
      
      if (!orderResult.success) {
        console.log(`❌ Failed to place order for ${signal.symbol}: ${orderResult.reason}`);
        await this.markSignalRejected(signal.id, orderResult.reason || 'Order placement failed');
        return { success: false, reason: orderResult.reason };
      }

      // Step 7: Mark signal as processed
      console.log(`✅ Order placed successfully for ${signal.symbol}, marking signal as processed...`);
      await supabase
        .from('trading_signals')
        .update({ processed: true })
        .eq('id', signal.id);
      
      await this.logger.logSuccess(`Signal executed successfully for ${signal.symbol}`, {
        symbol: signal.symbol,
        signalId: signal.id,
        entryPrice,
        quantity: finalQuantity,
        takeProfitPrice,
        formattingMethod: 'bybit_instrument_info'
      });

      console.log(`✅ ===== SIGNAL ${signal.id} FOR ${signal.symbol} COMPLETED SUCCESSFULLY =====`);
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Error executing signal ${signal.id}:`, error);
      await this.markSignalRejected(signal.id, error.message);
      return { success: false, reason: error.message };
    }
  }

  private async markSignalRejected(signalId: string, reason: string): Promise<void> {
    try {
      console.log(`❌ Marking signal ${signalId} as rejected: ${reason}`);
      
      await supabase
        .from('trading_signals')
        .update({ processed: true })
        .eq('id', signalId);

      await this.logger.log('signal_rejected', `Signal rejected: ${reason}`, {
        signalId,
        reason,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking signal as rejected:', error);
    }
  }
}
