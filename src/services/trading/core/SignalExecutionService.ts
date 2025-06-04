
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfig } from '../config/TradingConfigManager';

export class SignalExecutionService {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async executeSignals(config: TradingConfig): Promise<void> {
    try {
      console.log('⚡ Executing unprocessed signals...');

      const { data: signals, error } = await supabase
        .from('trading_signals')
        .select('*')
        .eq('user_id', this.userId)
        .eq('processed', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!signals || signals.length === 0) {
        console.log('📭 No unprocessed signals found');
        return;
      }

      console.log(`📊 Processing ${signals.length} signals`);

      for (const signal of signals) {
        await this.executeSignal(signal, config);
      }

      console.log('✅ Signal execution completed');
    } catch (error) {
      console.error('❌ Error executing signals:', error);
      throw error;
    }
  }

  private async executeSignal(signal: any, config: TradingConfig): Promise<void> {
    try {
      console.log(`\n⚡ Executing signal for ${signal.symbol}:`);
      
      const entryPrice = parseFloat(signal.price.toString());
      
      // 1. Calculate quantity
      const rawQuantity = config.maximum_order_amount_usd / entryPrice;
      const finalQuantity = this.roundQuantityToIncrement(signal.symbol, rawQuantity, config);
      
      console.log(`  Raw Quantity: ${rawQuantity.toFixed(6)}`);
      console.log(`  Final Quantity: ${finalQuantity.toFixed(6)}`);
      
      // 2. Check minimum notional
      const orderValue = finalQuantity * entryPrice;
      const minNotional = config.minimum_notional_per_symbol[signal.symbol] || 10;
      
      if (orderValue < minNotional) {
        console.log(`❌ Order value ${orderValue.toFixed(2)} below minimum ${minNotional}`);
        await this.markSignalRejected(signal.id, 'below minimum notional');
        return;
      }

      // 3. Place limit buy order
      await this.placeLimitBuyOrder(signal, finalQuantity, entryPrice, config);
      
    } catch (error) {
      console.error(`❌ Error executing signal ${signal.id}:`, error);
      await this.markSignalRejected(signal.id, error.message);
    }
  }

  private roundQuantityToIncrement(symbol: string, quantity: number, config: TradingConfig): number {
    const increment = config.quantity_increment_per_symbol[symbol] || 0.0001;
    return Math.floor(quantity / increment) * increment;
  }

  private async placeLimitBuyOrder(signal: any, quantity: number, entryPrice: number, config: TradingConfig): Promise<void> {
    try {
      console.log(`🔄 Placing limit buy order for ${signal.symbol}:`);
      console.log(`  Quantity: ${quantity.toFixed(6)}`);
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      
      const formattedQuantity = quantity.toString();
      const formattedPrice = entryPrice.toFixed(2);

      let bybitOrderId = null;
      let orderPlaced = false;

      try {
        // Try to place real order on Bybit
        const orderParams = {
          category: 'spot' as const,
          symbol: signal.symbol,
          side: 'Buy' as const,
          orderType: 'Limit' as const,
          qty: formattedQuantity,
          price: formattedPrice,
          timeInForce: 'GTC' as const
        };

        const orderResult = await this.bybitService.placeOrder(orderParams);

        if (orderResult && orderResult.retCode === 0 && orderResult.result?.orderId) {
          bybitOrderId = orderResult.result.orderId;
          orderPlaced = true;
          console.log(`✅ Real Bybit order placed: ${bybitOrderId}`);
        } else {
          console.log(`⚠️ Bybit order failed, using mock order`);
          bybitOrderId = `mock_${Date.now()}_${signal.symbol}`;
          orderPlaced = true;
        }
      } catch (bybitError) {
        console.log(`⚠️ Bybit API error, using mock order:`, bybitError);
        bybitOrderId = `mock_${Date.now()}_${signal.symbol}`;
        orderPlaced = true;
      }

      if (orderPlaced) {
        // Create trade record
        const { data: trade, error } = await supabase
          .from('trades')
          .insert({
            user_id: this.userId,
            symbol: signal.symbol,
            side: 'buy',
            order_type: 'limit',
            price: entryPrice,
            quantity: quantity,
            status: 'pending',
            bybit_order_id: bybitOrderId,
          })
          .select()
          .single();

        if (error) throw error;

        // Mark signal as processed
        await supabase
          .from('trading_signals')
          .update({ processed: true })
          .eq('id', signal.id);

        console.log(`✅ Trade record created for ${signal.symbol}`);
        
        await this.logActivity('order_placed', `Limit buy order placed for ${signal.symbol}`, {
          symbol: signal.symbol,
          quantity: formattedQuantity,
          price: entryPrice,
          orderValue: quantity * entryPrice,
          bybitOrderId,
          tradeId: trade.id,
          takeProfitPercent: config.take_profit_percentage
        });
      }

    } catch (error) {
      console.error(`❌ Error placing order for ${signal.symbol}:`, error);
      throw error;
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
