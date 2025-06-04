
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
      const increment = config.quantity_increment_per_symbol[signal.symbol] || 0.0001;
      const finalQuantity = Math.floor(rawQuantity / increment) * increment;
      
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

      // 3. Calculate take-profit price
      const takeProfitPrice = entryPrice * (1 + config.take_profit_percentage / 100);
      
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(4)} (+${config.take_profit_percentage}%)`);

      // 4. Place REAL limit buy order on Bybit - NO MOCK ORDERS
      await this.placeRealBybitOrder(signal, finalQuantity, entryPrice, takeProfitPrice, config);
      
    } catch (error) {
      console.error(`❌ Error executing signal ${signal.id}:`, error);
      await this.markSignalRejected(signal.id, error.message);
    }
  }

  private async placeRealBybitOrder(signal: any, quantity: number, entryPrice: number, takeProfitPrice: number, config: TradingConfig): Promise<void> {
    try {
      console.log(`🔄 Placing REAL limit buy order on Bybit for ${signal.symbol}:`);
      console.log(`  Quantity: ${quantity.toFixed(6)}`);
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(4)}`);
      
      const formattedQuantity = quantity.toString();
      const formattedEntryPrice = entryPrice.toFixed(2);

      // ALWAYS place real Bybit order - no fallback to mock
      const buyOrderParams = {
        category: 'spot' as const,
        symbol: signal.symbol,
        side: 'Buy' as const,
        orderType: 'Limit' as const,
        qty: formattedQuantity,
        price: formattedEntryPrice,
        timeInForce: 'GTC' as const
      };

      console.log('📝 Placing REAL BUY order with params:', buyOrderParams);
      const buyOrderResult = await this.bybitService.placeOrder(buyOrderParams);

      if (buyOrderResult && buyOrderResult.retCode === 0 && buyOrderResult.result?.orderId) {
        const bybitOrderId = buyOrderResult.result.orderId;
        console.log(`✅ REAL Bybit BUY order placed successfully: ${bybitOrderId}`);

        // Create trade record ONLY after successful Bybit order placement
        const { data: trade, error } = await supabase
          .from('trades')
          .insert({
            user_id: this.userId,
            symbol: signal.symbol,
            side: 'buy',
            order_type: 'limit',
            price: entryPrice,
            quantity: quantity,
            status: 'pending', // Real orders start as pending until Bybit confirms fill
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

        console.log(`✅ Trade record created for REAL Bybit order ${bybitOrderId}`);
        
        await this.logActivity('order_placed', `REAL limit buy order placed on Bybit for ${signal.symbol}`, {
          symbol: signal.symbol,
          quantity: formattedQuantity,
          entryPrice: entryPrice,
          takeProfitPrice: takeProfitPrice,
          orderValue: quantity * entryPrice,
          bybitOrderId,
          tradeId: trade.id,
          orderType: 'REAL_BYBIT_LIMIT_ORDER'
        });

        // Place take-profit limit sell order after successful buy order
        await this.placeTakeProfitOrder(signal.symbol, quantity, takeProfitPrice);

      } else {
        console.error(`❌ Bybit order FAILED - retCode: ${buyOrderResult?.retCode}, retMsg: ${buyOrderResult?.retMsg}`);
        await this.markSignalRejected(signal.id, `Bybit order failed: ${buyOrderResult?.retMsg || 'Unknown error'}`);
        
        // Log the failure
        await this.logActivity('order_failed', `Bybit order failed for ${signal.symbol}`, {
          symbol: signal.symbol,
          error: buyOrderResult?.retMsg || 'Unknown error',
          retCode: buyOrderResult?.retCode
        });
      }

    } catch (error) {
      console.error(`❌ Error placing REAL order for ${signal.symbol}:`, error);
      await this.markSignalRejected(signal.id, `Order placement error: ${error.message}`);
      throw error;
    }
  }

  private async placeTakeProfitOrder(symbol: string, quantity: number, takeProfitPrice: number): Promise<void> {
    try {
      console.log(`🎯 Placing take-profit limit sell order for ${symbol}`);
      
      const sellOrderParams = {
        category: 'spot' as const,
        symbol: symbol,
        side: 'Sell' as const,
        orderType: 'Limit' as const,
        qty: quantity.toString(),
        price: takeProfitPrice.toFixed(2),
        timeInForce: 'GTC' as const
      };

      console.log('📝 Placing take-profit SELL order:', sellOrderParams);
      const sellOrderResult = await this.bybitService.placeOrder(sellOrderParams);
      
      if (sellOrderResult && sellOrderResult.retCode === 0) {
        console.log(`✅ Take-profit order placed: ${sellOrderResult.result?.orderId}`);
        
        await this.logActivity('order_placed', `Take-profit limit sell order placed for ${symbol}`, {
          symbol,
          quantity: quantity.toString(),
          takeProfitPrice,
          bybitOrderId: sellOrderResult.result?.orderId,
          orderType: 'TAKE_PROFIT_LIMIT_SELL'
        });
      } else {
        console.log(`⚠️ Take-profit order failed: ${sellOrderResult?.retMsg}`);
        
        await this.logActivity('order_failed', `Take-profit order failed for ${symbol}`, {
          symbol,
          error: sellOrderResult?.retMsg || 'Unknown error'
        });
      }
    } catch (error) {
      console.error(`❌ Error placing take-profit order for ${symbol}:`, error);
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
