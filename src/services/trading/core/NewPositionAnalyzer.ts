
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { SupportLevelProcessor } from './SupportLevelProcessor';
import { SignalContext } from './SignalAnalysisCore';

export interface NewPositionResult {
  shouldCreateSignal: boolean;
  entryPrice?: number;
  reasoning?: string;
  confidence?: number;
  supportLevel?: number;
}

export class NewPositionAnalyzer {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async analyzeNewPosition(context: SignalContext, currentPrice: number, config: TradingConfigData): Promise<NewPositionResult> {
    if (context.isAveragingDown) {
      return { shouldCreateSignal: false };
    }

    try {
      console.log(`🔍 ${context.symbol}: Analyzing new position at current price: ${currentPrice}`);

      // Get recent market data for analysis
      const { data: recentData, error } = await supabase
        .from('market_data')
        .select('*')
        .eq('symbol', context.symbol)
        .order('timestamp', { ascending: false })
        .limit(config.support_candle_count || 128);

      if (error) {
        console.error(`❌ Error fetching market data for ${context.symbol}:`, error);
        return { shouldCreateSignal: false };
      }

      // Calculate support level with proper formatting
      let supportLevel: number;
      
      if (recentData && recentData.length >= 10) {
        // Use recent lows to find support
        const recentLows = recentData.map(d => parseFloat(d.price.toString())).sort((a, b) => a - b);
        const lowestPrice = recentLows[0];
        const supportCandidate = lowestPrice * 1.005; // 0.5% above lowest price
        
        supportLevel = await SupportLevelProcessor.formatSupportLevel(context.symbol, supportCandidate);
      } else {
        // Fallback: support 1% below current price
        supportLevel = await SupportLevelProcessor.formatSupportLevel(context.symbol, currentPrice * 0.99);
      }

      // Check if current price is near support level
      const priceToSupportPercent = ((currentPrice - supportLevel) / supportLevel) * 100;
      
      console.log(`📊 ${context.symbol}: Support analysis - Support: ${supportLevel}, Current: ${currentPrice}, Distance: ${priceToSupportPercent.toFixed(2)}%`);

      // Only create signal if price is within bounds of support level
      const lowerBound = config.support_lower_bound_percent || 0.5;
      const upperBound = config.support_upper_bound_percent || 2.0;

      if (priceToSupportPercent < -lowerBound || priceToSupportPercent > upperBound) {
        console.log(`❌ ${context.symbol}: Price not within support bounds (${-lowerBound}% to +${upperBound}%)`);
        return { shouldCreateSignal: false };
      }

      // Calculate entry price with proper formatting
      const entryPrice = await SupportLevelProcessor.calculateFormattedEntryPrice(
        context.symbol,
        currentPrice,
        -config.entry_offset_percent // Negative for buy below current price
      );

      // Validate the calculated price
      const isPriceValid = await SupportLevelProcessor.validatePriceRange(context.symbol, entryPrice);
      if (!isPriceValid) {
        console.log(`❌ ${context.symbol}: Entry price validation failed`);
        return { shouldCreateSignal: false };
      }

      const confidence = 0.8; // Higher confidence for new positions near support
      const reasoning = `NEW POSITION: Entry at ${entryPrice} (${config.entry_offset_percent}% below current ${currentPrice}). Support level: ${supportLevel}`;

      console.log(`✅ ${context.symbol}: New position signal generated - Entry: ${entryPrice}, Support: ${supportLevel}, Confidence: ${confidence}`);

      return {
        shouldCreateSignal: true,
        entryPrice,
        reasoning,
        confidence,
        supportLevel
      };
    } catch (error) {
      console.error(`❌ Error in new position analysis for ${context.symbol}:`, error);
      return { shouldCreateSignal: false };
    }
  }
}
