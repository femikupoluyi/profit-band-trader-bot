
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SupportLevel } from './supportLevelAnalyzer';

export interface GeneratedSignal {
  symbol: string;
  action: 'buy' | 'sell';
  price: number;
  confidence: number;
  reasoning: string;
}

export class SignalGenerator {
  private userId: string;
  private config: TradingConfigData;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
  }

  async generateSignal(symbol: string, currentPrice: number, supportLevel: SupportLevel): Promise<GeneratedSignal | null> {
    try {
      // Check if price is near support level with entry offset
      const entryOffset = this.config.entry_offset_percent || 0.5;
      const targetEntryPrice = supportLevel.price * (1 + entryOffset / 100);
      
      // Only generate buy signal if current price is close to our target entry
      const priceDistance = Math.abs(currentPrice - targetEntryPrice) / targetEntryPrice;
      
      if (priceDistance > 0.02) { // More than 2% away
        return null;
      }

      // Calculate confidence based on support strength and price proximity
      let confidence = supportLevel.strength * 0.6; // Base confidence from support
      
      // Add proximity factor
      const proximityFactor = Math.max(0, 1 - (priceDistance * 50)); // Closer = higher confidence
      confidence += proximityFactor * 0.4;

      // Minimum confidence threshold
      if (confidence < 0.3) {
        return null;
      }

      const signal: GeneratedSignal = {
        symbol,
        action: 'buy',
        price: targetEntryPrice,
        confidence: Math.min(1, confidence),
        reasoning: `Price near support level at $${supportLevel.price.toFixed(4)} with ${supportLevel.touches} touches. Entry at $${targetEntryPrice.toFixed(4)} (+${entryOffset}% above support)`
      };

      // Store signal in database
      await this.storeSignal(signal);

      return signal;
    } catch (error) {
      console.error('Error generating signal:', error);
      return null;
    }
  }

  private async storeSignal(signal: GeneratedSignal): Promise<void> {
    try {
      const { error } = await supabase
        .from('trading_signals')
        .insert({
          user_id: this.userId,
          symbol: signal.symbol,
          signal_type: signal.action,
          price: signal.price,
          confidence: signal.confidence,
          reasoning: signal.reasoning,
          processed: false
        });

      if (error) {
        console.error('Error storing signal:', error);
        throw error;
      }

      console.log(`✅ Signal stored for ${signal.symbol}: ${signal.action} at $${signal.price.toFixed(4)}`);
    } catch (error) {
      console.error('Error storing signal in database:', error);
      throw error;
    }
  }

  /**
   * Check if we should generate a signal based on current market conditions
   */
  shouldGenerateSignal(symbol: string, currentPrice: number, supportLevel: SupportLevel): boolean {
    // Check support bounds
    const lowerBound = this.config.support_lower_bound_percent || 5.0;
    const upperBound = this.config.support_upper_bound_percent || 2.0;
    
    const distanceFromSupport = ((currentPrice - supportLevel.price) / supportLevel.price) * 100;
    
    // Price should be within bounds
    if (distanceFromSupport < -lowerBound || distanceFromSupport > upperBound) {
      return false;
    }

    // Support should be strong enough
    if (supportLevel.strength < 0.3) {
      return false;
    }

    return true;
  }

  /**
   * Calculate optimal entry price based on support and configuration
   */
  calculateEntryPrice(supportLevel: SupportLevel): number {
    const entryOffset = this.config.entry_offset_percent || 0.5;
    return supportLevel.price * (1 + entryOffset / 100);
  }

  /**
   * Calculate take profit price based on entry and configuration
   */
  calculateTakeProfitPrice(entryPrice: number): number {
    const takeProfitPercent = this.config.take_profit_percent || 1.0;
    return entryPrice * (1 + takeProfitPercent / 100);
  }
}
