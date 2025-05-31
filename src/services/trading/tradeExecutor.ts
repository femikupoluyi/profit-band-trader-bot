
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class TradeExecutor {
  private userId: string;
  private config: TradingConfigData;
  private bybitService: BybitService;

  constructor(userId: string, config: TradingConfigData, bybitService: BybitService) {
    this.userId = userId;
    this.config = config;
    this.bybitService = bybitService;
  }

  async processSignals(): Promise<void> {
    try {
      const { data: signals } = await (supabase as any)
        .from('trading_signals')
        .select('*')
        .eq('user_id', this.userId)
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(5);

      if (!signals || signals.length === 0) {
        console.log('No unprocessed signals found');
        return;
      }

      console.log(`Processing ${signals.length} signals...`);
      for (const signal of signals) {
        console.log('Processing signal:', signal);
        await this.executeSignal(signal);
      }
    } catch (error) {
      console.error('Error processing signals:', error);
    }
  }

  private async executeSignal(signal: any): Promise<void> {
    try {
      console.log(`Executing signal for ${signal.symbol}:`, signal);
      
      // Check if we can execute this signal based on config
      const canExecute = await this.validateSignalExecution(signal);
      if (!canExecute) {
        console.log('Signal validation failed, marking as processed');
        await this.markSignalProcessed(signal.id);
        return;
      }

      // Calculate order size
      const orderSize = this.calculateOrderSize(signal.symbol, signal.price);
      if (orderSize <= 0) {
        console.log('Order size too small, marking signal as processed');
        await this.markSignalProcessed(signal.id);
        return;
      }

      console.log(`Placing ${signal.signal_type} order: ${orderSize} ${signal.symbol} at $${signal.price}`);

      // Place order
      const orderResult = await this.bybitService.placeOrder({
        symbol: signal.symbol,
        side: signal.signal_type === 'buy' ? 'Buy' : 'Sell',
        orderType: 'Market',
        qty: orderSize.toString(),
      });

      console.log('Order result:', orderResult);

      // Record trade
      await (supabase as any)
        .from('trades')
        .insert({
          user_id: this.userId,
          symbol: signal.symbol,
          side: signal.signal_type,
          order_type: 'market',
          quantity: orderSize,
          price: signal.price,
          status: orderResult.retCode === 0 ? 'pending' : 'failed',
          bybit_order_id: orderResult.result?.orderId,
        });

      await this.logActivity('trade', `Executed ${signal.signal_type} order for ${signal.symbol}`, {
        signal,
        orderResult,
        orderSize,
      });

      await this.markSignalProcessed(signal.id);
    } catch (error) {
      console.error('Error executing signal:', error);
      await this.logActivity('error', `Failed to execute signal for ${signal.symbol}`, { error: error.message });
      await this.markSignalProcessed(signal.id);
    }
  }

  private async validateSignalExecution(signal: any): Promise<boolean> {
    // Check max active pairs
    const { count: activePairs } = await (supabase as any)
      .from('trades')
      .select('symbol', { count: 'exact', head: true })
      .eq('user_id', this.userId)
      .eq('status', 'pending');

    console.log(`Active pairs: ${activePairs}/${this.config.max_active_pairs}`);
    
    if (activePairs >= this.config.max_active_pairs) {
      console.log('Max active pairs reached');
      return false;
    }

    return true;
  }

  private calculateOrderSize(symbol: string, price: number): number {
    // Simple calculation: use max order amount divided by price
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
