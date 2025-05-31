
import { supabase } from '@/integrations/supabase/client';
import { TradingSignal, SupportLevel } from './types';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class SignalGenerator {
  private userId: string;
  private config: TradingConfigData;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
  }

  async generateSignal(
    symbol: string, 
    currentPrice: number, 
    supportLevel: SupportLevel
  ): Promise<TradingSignal | null> {
    try {
      const entryOffsetPercent = 1.5;
      const entryPrice = supportLevel.price * (1 + entryOffsetPercent / 100);
      
      // Use min_profit_percent instead of take_profit_percent
      const takeProfitPercent = this.config.min_profit_percent || 2.0;
      const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);

      const priceWithinRange = currentPrice <= entryPrice && currentPrice >= supportLevel.price * 0.98;
      
      console.log(`${symbol} signal check: Current ${currentPrice}, Support ${supportLevel.price.toFixed(4)}, Entry ${entryPrice.toFixed(4)}, InRange: ${priceWithinRange}`);

      if (priceWithinRange) {
        const signal: TradingSignal = {
          symbol,
          action: 'buy',
          price: currentPrice,
          confidence: Math.max(supportLevel.strength, 0.6),
          reasoning: `Support level at ${supportLevel.price.toFixed(4)}, entry at ${entryPrice.toFixed(4)}, TP at ${takeProfitPrice.toFixed(4)}`,
          supportLevel: supportLevel.price,
          takeProfitPrice: takeProfitPrice,
        };

        console.log(`Generated buy signal for ${symbol}:`, signal);
        await this.createSignal(signal);
        return signal;
      } else {
        console.log(`${symbol}: Current price ${currentPrice} not in entry range (${(supportLevel.price * 0.98).toFixed(4)} - ${entryPrice.toFixed(4)})`);
        return null;
      }
    } catch (error) {
      console.error(`Error generating signal for ${symbol}:`, error);
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
