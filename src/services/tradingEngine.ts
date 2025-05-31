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
  private loopCount = 0;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing trading engine for user:', this.userId);
      
      // Fetch API credentials
      const { data: credentials } = await (supabase as any)
        .from('api_credentials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('exchange_name', 'bybit')
        .eq('is_active', true)
        .single();

      if (credentials) {
        console.log('Found API credentials for Bybit, testnet:', credentials.testnet);
        this.bybitService = new BybitService({
          apiKey: credentials.api_key,
          apiSecret: credentials.api_secret,
          testnet: credentials.testnet,
        });
        
        // Test the connection
        try {
          const balance = await this.bybitService.getAccountBalance();
          console.log('API connection test successful:', balance.retCode === 0 ? 'Connected' : 'Error');
          await this.logActivity('info', 'API connection established', { testnet: credentials.testnet });
        } catch (error) {
          console.log('API connection test failed:', error);
          await this.logActivity('error', 'API connection failed', { error: error.message });
        }
      } else {
        console.log('No active API credentials found');
        await this.logActivity('error', 'No active API credentials found');
      }
    } catch (error) {
      console.error('Error initializing trading engine:', error);
      await this.logActivity('error', 'Failed to initialize trading engine', { error: error.message });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.loopCount = 0;
    await this.logActivity('info', 'Trading engine started');
    console.log('Trading engine started, beginning main loop...');
    
    // Main trading loop
    this.tradingLoop();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.logActivity('info', 'Trading engine stopped');
    console.log('Trading engine stopped');
  }

  private async tradingLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        this.loopCount++;
        console.log(`Trading loop iteration #${this.loopCount}`);

        if (!this.bybitService) {
          console.log('No Bybit service, attempting to initialize...');
          await this.initialize();
          if (!this.bybitService) {
            console.log('Still no Bybit service, waiting 60 seconds...');
            await this.sleep(60000); // Wait 1 minute before retrying
            continue;
          }
        }

        console.log('Scanning markets...');
        await this.scanMarkets();
        
        console.log('Processing signals...');
        await this.processSignals();
        
        console.log('Monitoring positions...');
        await this.monitorPositions();
        
        console.log(`Loop #${this.loopCount} complete, waiting 30 seconds...`);
        // Wait before next iteration
        await this.sleep(30000); // 30 seconds
      } catch (error) {
        console.error('Error in trading loop:', error);
        await this.logActivity('error', 'Trading loop error', { error: error.message, loopCount: this.loopCount });
        await this.sleep(60000); // Wait 1 minute on error
      }
    }
  }

  private async scanMarkets(): Promise<void> {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT'];
    console.log('Scanning symbols:', symbols);
    
    for (const symbol of symbols) {
      try {
        console.log(`Getting price for ${symbol}...`);
        const marketPrice = await this.bybitService!.getMarketPrice(symbol);
        console.log(`${symbol} price: $${marketPrice.price}`);
        
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
          console.log(`Generated signal for ${symbol}:`, signal);
          await this.createSignal(signal);
        } else {
          console.log(`No signal generated for ${symbol}`);
        }
      } catch (error) {
        console.error(`Error scanning ${symbol}:`, error);
        await this.logActivity('error', `Failed to scan ${symbol}`, { error: error.message });
      }
    }
  }

  private async analyzeMarket(symbol: string, currentPrice: number): Promise<TradingSignal | null> {
    try {
      console.log(`Analyzing ${symbol} at price $${currentPrice}`);
      
      // Get recent price data
      const { data: recentPrices } = await (supabase as any)
        .from('market_data')
        .select('price, timestamp')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (!recentPrices || recentPrices.length < 5) {
        console.log(`Not enough price data for ${symbol} (${recentPrices?.length || 0} points)`);
        return null;
      }

      const prices = recentPrices.map(p => parseFloat(p.price));
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      
      console.log(`${symbol} analysis: current=$${currentPrice}, avg=$${avgPrice.toFixed(2)}`);
      
      // Simple strategy: buy if price is below average minus lower offset, sell if above average plus upper offset
      const buyThreshold = avgPrice * (1 + this.config.buy_range_lower_offset / 100);
      const sellThreshold = avgPrice * (1 + this.config.sell_range_offset / 100);

      console.log(`${symbol} thresholds: buy<=$${buyThreshold.toFixed(2)}, sell>=$${sellThreshold.toFixed(2)}`);

      if (currentPrice <= buyThreshold) {
        const signal = {
          symbol,
          action: 'buy' as const,
          price: currentPrice,
          confidence: 0.7,
          reasoning: `Price ${currentPrice} is below buy threshold ${buyThreshold.toFixed(2)}`,
        };
        console.log(`BUY signal for ${symbol}:`, signal);
        return signal;
      } else if (currentPrice >= sellThreshold) {
        const signal = {
          symbol,
          action: 'sell' as const,
          price: currentPrice,
          confidence: 0.7,
          reasoning: `Price ${currentPrice} is above sell threshold ${sellThreshold.toFixed(2)}`,
        };
        console.log(`SELL signal for ${symbol}:`, signal);
        return signal;
      }

      console.log(`No signal for ${symbol} - price within normal range`);
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
      console.log(`Signal created for ${signal.symbol}:`, signal);
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
      const orderResult = await this.bybitService!.placeOrder({
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

  private async monitorPositions(): Promise<void> {
    try {
      const { data: pendingTrades } = await (supabase as any)
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'pending');

      if (!pendingTrades || pendingTrades.length === 0) {
        console.log('No pending trades to monitor');
        return;
      }

      console.log(`Monitoring ${pendingTrades.length} pending trades...`);

      for (const trade of pendingTrades) {
        if (trade.bybit_order_id) {
          const orderStatus = await this.bybitService!.getOrderStatus(trade.bybit_order_id);
          
          if (orderStatus.result && orderStatus.result.list && orderStatus.result.list.length > 0) {
            const order = orderStatus.result.list[0];
            const newStatus = this.mapOrderStatus(order.orderStatus);
            
            console.log(`Trade ${trade.id} status: ${order.orderStatus} -> ${newStatus}`);
            
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
