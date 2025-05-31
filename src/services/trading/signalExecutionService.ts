
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
      console.log(`Executing signal for ${signal.symbol}:`, signal);
      
      const canExecute = await this.validateSignalExecution(signal);
      if (!canExecute) {
        console.log('Signal validation failed, marking as processed');
        await this.markSignalProcessed(signal.id);
        return;
      }

      const orderSize = this.calculateOrderSize(signal.symbol, signal.price);
      if (orderSize <= 0) {
        console.log('Order size too small, marking signal as processed');
        await this.markSignalProcessed(signal.id);
        return;
      }

      console.log(`Placing ${signal.signal_type} order: ${orderSize} ${signal.symbol} at $${signal.price}`);

      const orderResult = await this.bybitService.placeOrder({
        symbol: signal.symbol,
        side: 'Buy',
        orderType: 'Market',
        qty: orderSize.toString(),
      });

      console.log('Order result:', orderResult);

      if (orderResult.retCode === 0) {
        const { data: trade } = await (supabase as any)
          .from('trades')
          .insert({
            user_id: this.userId,
            symbol: signal.symbol,
            side: 'buy',
            order_type: 'market',
            quantity: orderSize,
            price: signal.price,
            status: 'filled',
            bybit_order_id: orderResult.result?.orderId,
          })
          .select()
          .single();

        if (trade) {
          await this.setTakeProfit(trade, signal);
        }

        await this.logActivity('trade', `Executed ${signal.signal_type} order for ${signal.symbol}`, {
          signal,
          orderResult,
          orderSize,
        });
      }

      await this.markSignalProcessed(signal.id);
    } catch (error) {
      console.error('Error executing signal:', error);
      await this.logActivity('error', `Failed to execute signal for ${signal.symbol}`, { error: error.message });
      await this.markSignalProcessed(signal.id);
    }
  }

  private async setTakeProfit(trade: any, signal: any): Promise<void> {
    try {
      // Use take_profit_percent from config
      const takeProfitPercent = this.config.take_profit_percent || 2.0;
      const takeProfitPrice = parseFloat(trade.price) * (1 + takeProfitPercent / 100);

      console.log(`Setting take profit for ${trade.symbol} at ${takeProfitPrice}`);

      const tpOrder = await this.bybitService.placeOrder({
        symbol: trade.symbol,
        side: 'Sell',
        orderType: 'Limit',
        qty: trade.quantity.toString(),
        price: takeProfitPrice.toString(),
      });

      if (tpOrder.retCode === 0) {
        console.log(`Take profit order placed for ${trade.symbol} at ${takeProfitPrice}`);
        await this.logActivity('trade', `Take profit set for ${trade.symbol} at ${takeProfitPrice}`);
      } else {
        console.error(`Failed to set take profit for ${trade.symbol}:`, tpOrder);
      }
    } catch (error) {
      console.error(`Error setting take profit for ${trade.symbol}:`, error);
    }
  }

  private async validateSignalExecution(signal: any): Promise<boolean> {
    const { count: activePairs } = await (supabase as any)
      .from('trades')
      .select('symbol', { count: 'exact', head: true })
      .eq('user_id', this.userId)
      .in('status', ['pending', 'filled']);

    console.log(`Active pairs: ${activePairs}/${this.config.max_active_pairs}`);
    
    if (activePairs >= this.config.max_active_pairs) {
      console.log('Max active pairs reached');
      return false;
    }

    return true;
  }

  private calculateOrderSize(symbol: string, price: number): number {
    const maxOrderUsd = this.config.max_order_amount_usd;
    const orderSize = maxOrderUsd / price;
    console.log(`Order size calculation: $${maxOrderUsd} / $${price} = ${orderSize}`);
    return orderSize;
  }

  private async markSignalProcessed(signalId: string): Promise<void> {
    await (supabase as any)
      .from('trading_signals')
      .update({ processed: true })
      .eq('id', signalId);
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await (supabase as any)
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
