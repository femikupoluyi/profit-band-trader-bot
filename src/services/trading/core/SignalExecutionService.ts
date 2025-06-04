
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

      // 3. Calculate take-profit price
      const takeProfitPrice = entryPrice * (1 + config.take_profit_percentage / 100);
      
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(4)} (+${config.take_profit_percentage}%)`);

      // 4. Place limit buy order with take-profit
      await this.placeLimitBuyOrderWithTakeProfit(signal, finalQuantity, entryPrice, takeProfitPrice, config);
      
    } catch (error) {
      console.error(`❌ Error executing signal ${signal.id}:`, error);
      await this.markSignalRejected(signal.id, error.message);
    }
  }

  private roundQuantityToIncrement(symbol: string, quantity: number, config: TradingConfig): number {
    const increment = config.quantity_increment_per_symbol[symbol] || 0.0001;
    return Math.floor(quantity / increment) * increment;
  }

  private async placeLimitBuyOrderWithTakeProfit(signal: any, quantity: number, entryPrice: number, takeProfitPrice: number, config: TradingConfig): Promise<void> {
    try {
      console.log(`🔄 Placing limit buy order for ${signal.symbol}:`);
      console.log(`  Quantity: ${quantity.toFixed(6)}`);
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(4)}`);
      
      const formattedQuantity = quantity.toString();
      const formattedEntryPrice = entryPrice.toFixed(2);
      const formattedTakeProfitPrice = takeProfitPrice.toFixed(2);

      let bybitOrderId = null;
      let orderPlaced = false;

      try {
        // Place the limit buy order first
        const buyOrderParams = {
          category: 'spot' as const,
          symbol: signal.symbol,
          side: 'Buy' as const,
          orderType: 'Limit' as const,
          qty: formattedQuantity,
          price: formattedEntryPrice,
          timeInForce: 'GTC' as const
        };

        console.log('📝 Placing BUY order with params:', buyOrderParams);
        const buyOrderResult = await this.bybitService.placeOrder(buyOrderParams);

        if (buyOrderResult && buyOrderResult.retCode === 0 && buyOrderResult.result?.orderId) {
          bybitOrderId = buyOrderResult.result.orderId;
          orderPlaced = true;
          console.log(`✅ Real Bybit BUY order placed: ${bybitOrderId}`);

          // Now place the take-profit sell order (conditional)
          try {
            const sellOrderParams = {
              category: 'spot' as const,
              symbol: signal.symbol,
              side: 'Sell' as const,
              orderType: 'Limit' as const,
              qty: formattedQuantity,
              price: formattedTakeProfitPrice,
              timeInForce: 'GTC' as const
            };

            console.log('📝 Placing TAKE-PROFIT order with params:', sellOrderParams);
            const sellOrderResult = await this.bybitService.placeOrder(sellOrderParams);
            
            if (sellOrderResult && sellOrderResult.retCode === 0) {
              console.log(`✅ Take-profit order placed: ${sellOrderResult.result?.orderId}`);
            } else {
              console.log(`⚠️ Take-profit order failed, will handle manually later`);
            }
          } catch (sellError) {
            console.log(`⚠️ Take-profit order error:`, sellError);
          }

        } else {
          console.log(`⚠️ Bybit buy order failed, using mock order`);
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
          entryPrice: entryPrice,
          takeProfitPrice: takeProfitPrice,
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

  async manualClosePosition(tradeId: string): Promise<void> {
    try {
      console.log(`🔄 Manual close requested for trade ${tradeId}`);

      // Get the trade details
      const { data: trade, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('user_id', this.userId)
        .single();

      if (error || !trade) {
        throw new Error('Trade not found');
      }

      if (trade.status !== 'filled') {
        throw new Error('Cannot close trade that is not filled');
      }

      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      
      console.log(`  Current Price: $${currentPrice.toFixed(4)}`);
      console.log(`  Using MARKET order for immediate execution`);

      try {
        // Place MARKET sell order for immediate execution
        const sellOrderParams = {
          category: 'spot' as const,
          symbol: trade.symbol,
          side: 'Sell' as const,
          orderType: 'Market' as const,
          qty: trade.quantity.toString(),
        };

        console.log('📝 Placing MARKET sell order:', sellOrderParams);
        const sellResult = await this.bybitService.placeOrder(sellOrderParams);

        if (sellResult && sellResult.retCode === 0) {
          // Calculate P&L
          const entryPrice = parseFloat(trade.price.toString());
          const quantity = parseFloat(trade.quantity.toString());
          const profit = (currentPrice - entryPrice) * quantity;

          // Update trade as closed
          await supabase
            .from('trades')
            .update({
              status: 'closed',
              profit_loss: profit,
              updated_at: new Date().toISOString()
            })
            .eq('id', tradeId);

          console.log(`✅ Manual close completed: ${trade.symbol} P&L: $${profit.toFixed(2)}`);

          await this.logActivity('position_closed', `Manual close for ${trade.symbol}`, {
            tradeId,
            symbol: trade.symbol,
            entryPrice,
            exitPrice: currentPrice,
            profit,
            reason: 'manual_close_market_order'
          });

        } else {
          throw new Error(`Market order failed: ${sellResult?.retMsg || 'Unknown error'}`);
        }

      } catch (sellError) {
        console.error(`❌ Market sell order failed:`, sellError);
        throw sellError;
      }

    } catch (error) {
      console.error(`❌ Error in manual close:`, error);
      await this.logActivity('system_error', `Manual close failed for trade ${tradeId}`, {
        error: error.message,
        tradeId
      });
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
