
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
      // Use config values for calculations
      const entryOffsetPercent = this.config.entry_offset_percent || 0.5;
      const takeProfitPercent = this.config.take_profit_percent || 1.0;
      
      const entryPrice = supportLevel.price * (1 + entryOffsetPercent / 100);
      const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);

      // RELAXED entry conditions for better signal generation
      // Allow signals when price is within 5% range around support level
      const supportLowerBound = supportLevel.price * 0.95;  // 5% below support
      const supportUpperBound = entryPrice * 1.02;          // 2% above entry price
      const priceWithinRange = currentPrice >= supportLowerBound && currentPrice <= supportUpperBound;
      
      console.log(`\n🎯 DETAILED SIGNAL CHECK for ${symbol}:`);
      console.log(`  Current Price: $${currentPrice.toFixed(4)}`);
      console.log(`  Support Level: $${supportLevel.price.toFixed(4)}`);
      console.log(`  Entry Price: $${entryPrice.toFixed(4)} (${entryOffsetPercent}% above support)`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(4)} (${takeProfitPercent}% above entry)`);
      console.log(`  Signal Range: $${supportLowerBound.toFixed(4)} - $${supportUpperBound.toFixed(4)}`);
      console.log(`  Range Check: ${priceWithinRange ? '✅ IN RANGE' : '❌ OUT OF RANGE'}`);
      console.log(`  Support Strength: ${supportLevel.strength}`);

      if (priceWithinRange) {
        const signal: TradingSignal = {
          symbol,
          action: 'buy',
          price: currentPrice,
          confidence: Math.max(supportLevel.strength, 0.7),
          reasoning: `BUY SIGNAL: Price ${currentPrice.toFixed(4)} within range ${supportLowerBound.toFixed(4)}-${supportUpperBound.toFixed(4)}. Support at ${supportLevel.price.toFixed(4)}, Entry at ${entryPrice.toFixed(4)}, TP at ${takeProfitPrice.toFixed(4)}`,
          supportLevel: supportLevel.price,
          takeProfitPrice: takeProfitPrice,
        };

        console.log(`🚀 GENERATING BUY SIGNAL for ${symbol}:`);
        console.log(`  Signal: ${JSON.stringify(signal, null, 2)}`);
        
        await this.createSignal(signal);
        return signal;
      } else {
        const belowRange = currentPrice < supportLowerBound;
        const aboveRange = currentPrice > supportUpperBound;
        console.log(`❌ NO SIGNAL for ${symbol}: Price ${currentPrice.toFixed(4)} is ${belowRange ? 'BELOW' : 'ABOVE'} signal range`);
        console.log(`  ${belowRange ? 'Too low' : 'Too high'} - need price between ${supportLowerBound.toFixed(4)} and ${supportUpperBound.toFixed(4)}`);
        return null;
      }
    } catch (error) {
      console.error(`Error generating signal for ${symbol}:`, error);
      return null;
    }
  }

  private async createSignal(signal: TradingSignal): Promise<void> {
    try {
      console.log(`📝 CREATING SIGNAL IN DATABASE for ${signal.symbol}:`);
      
      const { data, error } = await supabase
        .from('trading_signals')
        .insert({
          user_id: this.userId,
          symbol: signal.symbol,
          signal_type: signal.action,
          price: signal.price,
          confidence: signal.confidence,
          reasoning: signal.reasoning,
          processed: false,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ DATABASE ERROR creating signal:', error);
        throw error;
      }

      console.log(`✅ SIGNAL CREATED SUCCESSFULLY:`, data);

      await this.logActivity('signal_generated', `BUY signal created for ${signal.symbol} at $${signal.price.toFixed(4)}`, {
        signal,
        signalId: data.id,
        createdAt: data.created_at
      });
    } catch (error) {
      console.error('❌ Error creating signal:', error);
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
