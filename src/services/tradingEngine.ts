
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from './bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

interface TradingSignal {
  symbol: string;
  action: 'buy' | 'sell';
  price: number;
  confidence: number;
  reasoning: string;
}

export class TradingEngine {
  private userId: string;
  private config: TradingConfigData;
  private bybitService: BybitService | null = null;
  private isRunning = false;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Fetch API credentials
      const { data: credentials } = await (supabase as any)
        .from('api_credentials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('exchange_name', 'bybit')
        .eq('is_active', true)
        .single();

      if (credentials) {
        this.bybitService = new BybitService({
          apiKey: credentials.api_key,
          apiSecret: credentials.api_secret,
          testnet: credentials.testnet,
        });
      }
    } catch (error) {
      console.error('Error initializing trading engine:', error);
      await this.logActivity('error', 'Failed to initialize trading engine', { error: error.message });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    await this.logActivity('info', 'Trading engine started');
    
    // Main trading loop
    this.tradingLoop();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.logActivity('info', 'Trading engine stopped');
  }

  private async tradingLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        if (!this.bybitService) {
          await this.initialize();
          if (!this.bybitService) {
            await this.sleep(60000); // Wait 1 minute before retrying
            continue;
          }
        }

        await this.scanMarkets();
        await this.processSignals();
        await this.monitorPositions();
        
        // Wait before next iteration
        await this.sleep(30000); // 30 seconds
      } catch (error) {
        console.error('Error in trading loop:', error);
        await this.logActivity('error', 'Trading loop error', { error: error.message });
        await this.sleep(60000); // Wait 1 minute on error
      }
    }
  }

  private async scanMarkets(): Promise<void> {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT'];
    
    for (const symbol of symbols) {
      try {
        const marketPrice = await this.bybitService!.getMarketPrice(symbol);
        
        // Store market data
        await (supabase as any)
          .from('market_data')
          .insert({
            symbol,
            price: marketPrice.price,
            timestamp: new Date().toISOString(),
            source: 'bybit',
          });

        // Analyze for trading signals
        const signal = await this.analyzeMarket(symbol, marketPrice.price);
        if (signal) {
          await this.createSignal(signal);
        }
      } catch (error) {
        console.error(`Error scanning ${symbol}:`, error);
      }
    }
  }

  private async analyzeMarket(symbol: string, currentPrice: number): Promise<TradingSignal | null> {
    try {
      // Get recent price data
      const { data: recentPrices } = await (supabase as any)
        .from('market_data')
        .select('price, timestamp')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (!recentPrices || recentPrices.length < 10) {
        return null;
      }

      const prices = recentPrices.map(p => parseFloat(p.price));
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      
      // Simple strategy: buy if price is below average minus lower offset, sell if above average plus upper offset
      const buyThreshold = avgPrice * (1 + this.config.buy_range_lower_offset / 100);
      const sellThreshold = avgPrice * (1 + this.config.sell_range_offset / 100);

      if (currentPrice <= buyThreshold) {
        return {
          symbol,
          action: 'buy',
          price: currentPrice,
          confidence: 0.7,
          reasoning: `Price ${currentPrice} is below buy threshold ${buyThreshold.toFixed(2)}`,
        };
      } else if (currentPrice >= sellThreshold) {
        return {
          symbol,
          action: 'sell',
          price: currentPrice,
          confidence: 0.7,
          reasoning: `Price ${currentPrice} is above sell threshold ${sellThreshold.toFixed(2)}`,
        };
      }

      return null;
    } catch (error) {
      console.error(`Error analyzing market for ${symbol}:`, error);
      return null;
    }
  }

  private async createSignal(signal: TradingSignal): Promise<void> {
    try {
      await (supabase as any)
        .from('trading_signals')
        .insert({
          user_id: this.userId,
          symbol: signal.symbol,
          signal_type: signal.action,
          price: signal.price,
          confidence: signal.confidence,
          reasoning: signal.reasoning,
          processed: false,
        });

      await this.logActivity('scan', `Generated ${signal.action} signal for ${signal.symbol}`, signal);
    } catch (error) {
      console.error('Error creating signal:', error);
    }
  }

  private async processSignals(): Promise<void> {
    try {
      const { data: signals } = await (supabase as any)
        .from('trading_signals')
        .select('*')
        .eq('user_id', this.userId)
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(5);

      if (!signals || signals.length === 0) return;

      for (const signal of signals) {
        await this.executeSignal(signal);
      }
    } catch (error) {
      console.error('Error processing signals:', error);
    }
  }

  private async executeSignal(signal: any): Promise<void> {
    try {
      // Check if we can execute this signal based on config
      const canExecute = await this.validateSignalExecution(signal);
      if (!canExecute) {
        await this.markSignalProcessed(signal.id);
        return;
      }

      // Calculate order size
      const orderSize = this.calculateOrderSize(signal.symbol, signal.price);
      if (orderSize <= 0) {
        await this.markSignalProcessed(signal.id);
        return;
      }

      // Place order
      const orderResult = await this.bybitService!.placeOrder({
        symbol: signal.symbol,
        side: signal.signal_type === 'buy' ? 'Buy' : 'Sell',
        orderType: 'Market',
        qty: orderSize.toString(),
      });

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

    if (activePairs >= this.config.max_active_pairs) {
      return false;
    }

    // Add more validation logic here
    return true;
  }

  private calculateOrderSize(symbol: string, price: number): number {
    // Simple calculation: use max order amount divided by price
    const maxOrderUsd = this.config.max_order_amount_usd;
    return maxOrderUsd / price;
  }

  private async monitorPositions(): Promise<void> {
    try {
      const { data: pendingTrades } = await (supabase as any)
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'pending');

      if (!pendingTrades || pendingTrades.length === 0) return;

      for (const trade of pendingTrades) {
        if (trade.bybit_order_id) {
          const orderStatus = await this.bybitService!.getOrderStatus(trade.bybit_order_id);
          
          if (orderStatus.result && orderStatus.result.list && orderStatus.result.list.length > 0) {
            const order = orderStatus.result.list[0];
            const newStatus = this.mapOrderStatus(order.orderStatus);
            
            if (newStatus !== 'pending') {
              await (supabase as any)
                .from('trades')
                .update({
                  status: newStatus,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', trade.id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error monitoring positions:', error);
    }
  }

  private mapOrderStatus(bybitStatus: string): string {
    switch (bybitStatus) {
      case 'Filled':
        return 'filled';
      case 'Cancelled':
        return 'cancelled';
      case 'Rejected':
        return 'failed';
      default:
        return 'pending';
    }
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
