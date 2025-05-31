
import { supabase } from '@/integrations/supabase/client';
import { TradingSignal } from './types';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class SignalAnalyzer {
  private userId: string;
  private config: TradingConfigData;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
  }

  async analyzeAndCreateSignals(): Promise<void> {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT'];
    
    for (const symbol of symbols) {
      try {
        // Get current price from latest market data
        const { data: latestPrice } = await (supabase as any)
          .from('market_data')
          .select('price')
          .eq('symbol', symbol)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (!latestPrice) continue;

        const signal = await this.analyzeMarket(symbol, parseFloat(latestPrice.price));
        if (signal) {
          console.log(`Generated signal for ${symbol}:`, signal);
          await this.createSignal(signal);
        } else {
          console.log(`No signal generated for ${symbol}`);
        }
      } catch (error) {
        console.error(`Error analyzing ${symbol}:`, error);
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
