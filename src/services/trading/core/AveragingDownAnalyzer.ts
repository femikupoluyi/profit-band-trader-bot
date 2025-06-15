
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SupportLevelProcessor } from './SupportLevelProcessor';
import { SignalContext } from './SignalAnalysisCore';

export interface AveragingDownResult {
  shouldCreateSignal: boolean;
  entryPrice?: number;
  reasoning?: string;
  confidence?: number;
  supportLevel?: number;
}

export class AveragingDownAnalyzer {
  async analyzeAveragingDown(context: SignalContext, currentPrice: number, config: TradingConfigData): Promise<AveragingDownResult> {
    if (!context.isAveragingDown) {
      return { shouldCreateSignal: false };
    }

    try {
      const lastBoughtPrice = Math.max(...context.activeTrades.map(t => parseFloat(t.price.toString())));
      const priceChangePercent = ((currentPrice - lastBoughtPrice) / lastBoughtPrice) * 100;
      
      const lowerBound = -config.support_lower_bound_percent;
      const upperBound = config.support_upper_bound_percent;
      
      console.log(`📐 ${context.symbol}: Averaging analysis - Price change: ${priceChangePercent.toFixed(2)}%, bounds: ${lowerBound.toFixed(2)}% to +${upperBound.toFixed(2)}%`);

      if (priceChangePercent < lowerBound || priceChangePercent > upperBound) {
        console.log(`❌ ${context.symbol}: Price not in averaging range`);
        return { shouldCreateSignal: false };
      }

      // Calculate entry price with proper Bybit precision formatting
      const entryPrice = await SupportLevelProcessor.calculateFormattedEntryPrice(
        context.symbol, 
        currentPrice, 
        -config.entry_offset_percent  // Negative for buy below current price
      );

      // Validate the calculated price
      const isPriceValid = await SupportLevelProcessor.validatePriceRange(context.symbol, entryPrice);
      if (!isPriceValid) {
        console.log(`❌ ${context.symbol}: Entry price validation failed`);
        return { shouldCreateSignal: false };
      }

      const confidence = 0.7; // Lower confidence for averaging down
      const formattedCurrentPrice = await SupportLevelProcessor.formatSupportLevel(context.symbol, currentPrice);
      const formattedLastBoughtPrice = await SupportLevelProcessor.formatSupportLevel(context.symbol, lastBoughtPrice);
      
      const reasoning = `AVERAGING DOWN: Entry at ${entryPrice} (${config.entry_offset_percent}% below current price ${formattedCurrentPrice}). Last bought: ${formattedLastBoughtPrice}`;

      console.log(`✅ ${context.symbol}: Averaging down signal generated - Entry: ${entryPrice}, Confidence: ${confidence}`);

      return {
        shouldCreateSignal: true,
        entryPrice,
        reasoning,
        confidence,
        supportLevel: entryPrice
      };
    } catch (error) {
      console.error(`❌ Error in averaging down analysis for ${context.symbol}:`, error);
      return { shouldCreateSignal: false };
    }
  }
}
