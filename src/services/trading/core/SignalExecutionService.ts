
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
      console.log('\n⚡ Executing signals...');
      await this.logger.logSuccess('Starting signal execution');
      
      // Load configured trading pairs from user config
      const configuredPairs = await TradingPairsService.getConfiguredTradingPairs(this.userId);
      console.log(`📊 User has configured ${configuredPairs.length} trading pairs:`, configuredPairs);
      
      // Preload instrument info for configured trading pairs
      if (configuredPairs && configuredPairs.length > 0) {
        console.log(`🔄 Preloading instrument info for ${configuredPairs.length} configured trading pairs...`);
        await ConfigurableFormatter.preloadInstrumentInfo(configuredPairs);
      }
      
      // Get unprocessed signals
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
        return;
      }

      console.log(`📊 Found ${signals.length} unprocessed signals`);
      await this.logger.logSuccess(`Found ${signals.length} unprocessed signals`);

      for (const signal of signals) {
        // Check if the signal's symbol is configured for trading
        const isPairConfigured = await TradingPairsService.isPairConfiguredForTrading(signal.symbol, this.userId);
        
        if (!isPairConfigured) {
          console.log(`⚠️ Signal for ${signal.symbol} rejected: not configured for trading`);
          await this.markSignalRejected(signal.id, `Symbol ${signal.symbol} not configured for trading`);
          continue;
        }
        
        await this.processSingleSignal(signal, config);
      }
      
      await this.logger.logSuccess('Signal execution completed');
    } catch (error) {
      console.error(`❌ Error executing signals:`, error);
      await this.logger.logError('Error executing signals', error);
    }
  }

  private async processSingleSignal(signal: any, config: TradingConfigData): Promise<void> {
    try {
      console.log(`\n⚡ Processing signal for ${signal.symbol}:`);
      
      // Check position limits BEFORE executing signal
      const canExecute = await this.positionValidator.validatePositionLimits(signal.symbol, config);
      if (!canExecute) {
        console.log(`❌ Position limits exceeded for ${signal.symbol}, rejecting signal`);
        await this.markSignalRejected(signal.id, 'Position limits exceeded');
        return;
      }
      
      const entryPrice = parseFloat(signal.price.toString());
      
      // Calculate quantity with proper formatting - will now use Bybit instrument info
      const adjustedQuantity = TradeValidator.calculateQuantity(signal.symbol, config.max_order_amount_usd, entryPrice, config);
      
      // Use async formatting for precise Bybit compliance
      const formattedQuantityStr = await ConfigurableFormatter.formatQuantity(signal.symbol, adjustedQuantity);
      const finalQuantity = parseFloat(formattedQuantityStr);
      
      console.log(`  Calculated Quantity: ${adjustedQuantity}`);
      console.log(`  Final Formatted Quantity: ${finalQuantity}`);
      
      // Validate trade parameters with Bybit instrument requirements
      const isValidOrder = await ConfigurableFormatter.validateOrder(signal.symbol, entryPrice, finalQuantity);
      if (!isValidOrder) {
        await this.markSignalRejected(signal.id, 'Order validation failed (Bybit requirements)');
        return;
      }

      // Calculate take-profit price
      const takeProfitPrice = entryPrice * (1 + config.take_profit_percent / 100);
      
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(4)} (+${config.take_profit_percent}%)`);

      // Place REAL limit buy order on Bybit with dynamic formatting
      await this.orderPlacer.placeOrderWithTP(signal.symbol, 'buy', finalQuantity, entryPrice, takeProfitPrice);
      
      // Mark signal as processed
      await supabase
        .from('trading_signals')
        .update({ processed: true })
        .eq('id', signal.id);
      
      await this.logger.logSuccess(`Signal executed for ${signal.symbol}`, {
        symbol: signal.symbol,
        signalId: signal.id,
        entryPrice,
        quantity: finalQuantity,
        formattingMethod: 'bybit_instrument_info'
      });
      
    } catch (error) {
      console.error(`❌ Error executing signal ${signal.id}:`, error);
      await this.markSignalRejected(signal.id, error.message);
    }
  }

  private async markSignalRejected(signalId: string, reason: string): Promise<void> {
    try {
      await supabase
        .from('trading_signals')
        .update({ processed: true })
        .eq('id', signalId);

      await this.logger.log('signal_rejected', `Signal rejected: ${reason}`, {
        signalId,
        reason
      });
    } catch (error) {
      console.error('Error marking signal as rejected:', error);
    }
  }
}
