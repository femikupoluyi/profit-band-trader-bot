
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
      
      // SIMPLIFIED SIGNAL GENERATION - Generate signals more frequently
      // Place limit orders at or slightly below current price for immediate execution potential
      const entryPrice = currentPrice * 0.999; // Entry 0.1% below current price for better fill chance
      const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);

      // MUCH MORE RELAXED conditions for signal generation
      // Generate signals when price is reasonable and we have basic support data
      const priceIsReasonable = currentPrice > 0 && isFinite(currentPrice);
      const supportIsValid = supportLevel && supportLevel.price > 0;
      
      console.log(`\n🎯 RELAXED SIGNAL CHECK for ${symbol}:`);
      console.log(`  Current Price: $${currentPrice.toFixed(4)}`);
      console.log(`  Support Level: $${supportLevel?.price?.toFixed(4) || 'N/A'}`);
      console.log(`  Entry Price: $${entryPrice.toFixed(4)} (0.1% below current for better fills)`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(4)} (${takeProfitPercent}% above entry)`);
      console.log(`  Price Check: ${priceIsReasonable ? '✅ VALID' : '❌ INVALID'}`);
      console.log(`  Support Check: ${supportIsValid ? '✅ VALID' : '❌ INVALID'}`);

      // GENERATE SIGNAL for any valid price with basic support
      if (priceIsReasonable && supportIsValid) {
        const signal: TradingSignal = {
          symbol,
          action: 'buy',
          price: entryPrice, // Use calculated entry price instead of current price
          confidence: 0.8, // High confidence for more signal generation
          reasoning: `BUY SIGNAL: Entry at ${entryPrice.toFixed(4)} (0.1% below current ${currentPrice.toFixed(4)}). Support detected at ${supportLevel.price.toFixed(4)}, TP at ${takeProfitPrice.toFixed(4)}`,
          supportLevel: supportLevel.price,
          takeProfitPrice: takeProfitPrice,
        };

        console.log(`🚀 GENERATING BUY SIGNAL for ${symbol}:`);
        console.log(`  Strategy: Aggressive entry below current price for immediate fill potential`);
        console.log(`  Signal: ${JSON.stringify(signal, null, 2)}`);
        
        await this.createSignal(signal);
        return signal;
      } else {
        console.log(`❌ NO SIGNAL for ${symbol}: Price valid: ${priceIsReasonable}, Support valid: ${supportIsValid}`);
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
