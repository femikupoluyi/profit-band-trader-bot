
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class SignalExecutionService {
  private userId: string;
  private config: TradingConfigData;
  private bybitService: BybitService;

  constructor(userId: string, config: TradingConfigData, bybitService: BybitService) {
    this.userId = userId;
    this.config = config;
    this.bybitService = bybitService;
  }

  async executeSignal(signal: any): Promise<void> {
    try {
      console.log(`Executing signal for ${signal.symbol} using config values:`, {
        maxActivePairs: this.config.max_active_pairs,
        maxOrderAmount: this.config.max_order_amount_usd,
        takeProfitPercent: this.config.take_profit_percent
      });
      
      const canExecute = await this.validateSignalExecution(signal);
      if (!canExecute) {
        console.log('Signal validation failed, marking as processed');
        await this.markSignalProcessed(signal.id);
        return;
      }

      // Calculate order size using config value
      const orderSize = this.calculateOrderSize(signal.symbol, signal.price);
      if (orderSize <= 0) {
        console.log('Order size too small, marking signal as processed');
        await this.markSignalProcessed(signal.id);
        return;
      }

      console.log(`Placing ${signal.signal_type} order: ${orderSize} ${signal.symbol} at $${signal.price} (max order: $${this.config.max_order_amount_usd})`);

      const orderResult = await this.bybitService.placeOrder({
        symbol: signal.symbol,
        side: 'Buy',
        orderType: 'Market',
        qty: orderSize.toString(),
      });

      console.log('Order result:', orderResult);

      if (orderResult.retCode === 0) {
        const tradeData = {
          user_id: this.userId,
          symbol: signal.symbol,
          side: 'buy',
          order_type: 'market',
          quantity: parseFloat(orderSize.toFixed(8)),
          price: parseFloat(signal.price.toString()),
          status: 'filled',
          bybit_order_id: orderResult.result?.orderId || null,
          profit_loss: 0,
        };

        console.log('Inserting trade with data:', tradeData);

        const { data: trade, error: tradeError } = await supabase
          .from('trades')
          .insert(tradeData)
          .select()
          .single();

        if (tradeError) {
          console.error('Error inserting trade:', tradeError);
          await this.logActivity('error', `Failed to record trade for ${signal.symbol}`, { error: tradeError.message });
        } else if (trade) {
          console.log('Trade recorded successfully:', trade);
          await this.setTakeProfit(trade, signal);
          await this.logActivity('trade', `Executed ${signal.signal_type} order for ${signal.symbol} using config values`, {
            signal,
            orderResult,
            orderSize,
            tradeId: trade.id,
            configUsed: {
              takeProfitPercent: this.config.take_profit_percent,
              maxOrderAmount: this.config.max_order_amount_usd
            }
          });
        }
      } else {
        console.error('Order failed:', orderResult);
        await this.logActivity('error', `Order failed for ${signal.symbol}`, { orderResult });
      }

      await this.markSignalProcessed(signal.id);
    } catch (error) {
      console.error('Error executing signal:', error);
      await this.logActivity('error', `Failed to execute signal for ${signal.symbol}`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        signal 
      });
      await this.markSignalProcessed(signal.id);
    }
  }

  private async setTakeProfit(trade: any, signal: any): Promise<void> {
    try {
      // Use take_profit_percent from config
      const takeProfitPercent = this.config.take_profit_percent || 2.0;
      const entryPrice = parseFloat(trade.price.toString());
      const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);

      console.log(`Setting take profit for ${trade.symbol} at ${takeProfitPrice} (${takeProfitPercent}% from config)`);

      const tpOrder = await this.bybitService.placeOrder({
        symbol: trade.symbol,
        side: 'Sell',
        orderType: 'Limit',
        qty: trade.quantity.toString(),
        price: takeProfitPrice.toFixed(8),
      });

      if (tpOrder.retCode === 0) {
        console.log(`Take profit order placed for ${trade.symbol} at ${takeProfitPrice} using config TP ${takeProfitPercent}%`);
        await this.logActivity('trade', `Take profit set for ${trade.symbol} at ${takeProfitPrice}`, {
          tradeId: trade.id,
          takeProfitPrice,
          takeProfitPercent,
          configValue: takeProfitPercent
        });
      } else {
        console.error(`Failed to set take profit for ${trade.symbol}:`, tpOrder);
        await this.logActivity('warning', `Failed to set take profit for ${trade.symbol}`, { tpOrder });
      }
    } catch (error) {
      console.error(`Error setting take profit for ${trade.symbol}:`, error);
      await this.logActivity('error', `Error setting take profit for ${trade.symbol}`, { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async validateSignalExecution(signal: any): Promise<boolean> {
    try {
      const { count: activePairs, error } = await supabase
        .from('trades')
        .select('symbol', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled']);

      if (error) {
        console.error('Error validating signal execution:', error);
        return false;
      }

      const maxActivePairs = this.config.max_active_pairs || 5;
      console.log(`Active pairs: ${activePairs}/${maxActivePairs} (from config)`);
      
      if ((activePairs || 0) >= maxActivePairs) {
        console.log(`Max active pairs reached (${maxActivePairs} from config)`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in signal validation:', error);
      return false;
    }
  }

  private calculateOrderSize(symbol: string, price: number): number {
    // Use config value for max order amount
    const maxOrderUsd = this.config.max_order_amount_usd || 100;
    const orderSize = maxOrderUsd / price;
    console.log(`Order size calculation using config: $${maxOrderUsd} / $${price} = ${orderSize}`);
    return Math.max(0, orderSize);
  }

  private async markSignalProcessed(signalId: string): Promise<void> {
    try {
      await supabase
        .from('trading_signals')
        .update({ processed: true })
        .eq('id', signalId);
    } catch (error) {
      console.error('Error marking signal as processed:', error);
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
