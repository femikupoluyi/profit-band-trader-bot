
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { PositionValidator } from './PositionValidator';
import { OrderPlacer } from './OrderPlacer';
import { TradeValidator } from './TradeValidator';
import { PriceFormatter } from './PriceFormatter';

export class SignalExecutionService {
  private userId: string;
  private config: TradingConfigData;
  private bybitService: BybitService;
  private positionValidator: PositionValidator;
  private orderPlacer: OrderPlacer;

  constructor(userId: string, config: TradingConfigData, bybitService: BybitService) {
    this.userId = userId;
    this.config = config;
    this.bybitService = bybitService;
    this.positionValidator = new PositionValidator(userId);
    this.orderPlacer = new OrderPlacer(userId, bybitService);
  }

  async executeSignal(signal: any): Promise<void> {
    try {
      console.log(`\n⚡ Executing signal for ${signal.symbol}:`);
      
      // Check position limits BEFORE executing signal
      const canExecute = await this.positionValidator.validatePositionLimits(signal.symbol, this.config);
      if (!canExecute) {
        console.log(`❌ Position limits exceeded for ${signal.symbol}, rejecting signal`);
        await this.markSignalRejected(signal.id, 'Position limits exceeded');
        return;
      }
      
      const entryPrice = parseFloat(signal.price.toString());
      
      // Calculate quantity with proper formatting
      const adjustedQuantity = TradeValidator.calculateQuantity(signal.symbol, this.config.max_order_amount_usd, entryPrice, this.config);
      
      // Format quantity using symbol-specific precision rules
      const finalQuantity = parseFloat(PriceFormatter.formatQuantityForSymbol(signal.symbol, adjustedQuantity));
      
      console.log(`  Final Formatted Quantity: ${finalQuantity}`);
      
      // Validate trade parameters
      if (!TradeValidator.validateTradeParameters(signal.symbol, finalQuantity, entryPrice, this.config)) {
        await this.markSignalRejected(signal.id, 'Trade validation failed');
        return;
      }

      // Calculate take-profit price
      const takeProfitPrice = entryPrice * (1 + this.config.take_profit_percent / 100);
      
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(4)} (+${this.config.take_profit_percent}%)`);

      // Place REAL limit buy order on Bybit
      await this.orderPlacer.placeRealBybitOrder(signal, finalQuantity, entryPrice, takeProfitPrice);
      
      // Mark signal as processed
      await supabase
        .from('trading_signals')
        .update({ processed: true })
        .eq('id', signal.id);
      
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

      await this.logActivity('signal_rejected', `Signal rejected: ${reason}`, {
        signalId,
        reason
      });
    } catch (error) {
      console.error('Error marking signal as rejected:', error);
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: type,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
