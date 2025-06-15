
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';
import { SignalContext } from './SignalAnalysisCore';

export interface AveragingDownResult {
  shouldCreateSignal: boolean;
  entryPrice?: number;
  reasoning?: string;
  confidence?: number;
}

export class AveragingDownAnalyzer {
  async analyzeAveragingDown(context: SignalContext, currentPrice: number, config: TradingConfigData): Promise<AveragingDownResult> {
    if (!context.isAveragingDown) {
      return { shouldCreateSignal: false };
    }

    const lastBoughtPrice = Math.max(...context.activeTrades.map(t => parseFloat(t.price.toString())));
    const priceChangePercent = ((currentPrice - lastBoughtPrice) / lastBoughtPrice) * 100;
    
    const lowerBound = -config.support_lower_bound_percent;
    const upperBound = config.support_upper_bound_percent;
    
    console.log(`📐 ${context.symbol}: Averaging analysis - Price change: ${priceChangePercent.toFixed(2)}%, bounds: ${lowerBound.toFixed(2)}% to +${upperBound.toFixed(2)}%`);

    if (priceChangePercent < lowerBound || priceChangePercent > upperBound) {
      console.log(`❌ ${context.symbol}: Price not in averaging range`);
      return { shouldCreateSignal: false };
    }

    try {
      // Place limit order below current price for averaging down
      const entryPrice = currentPrice * (1 - config.entry_offset_percent / 100);
      const formattedEntryPrice = await BybitPrecisionFormatter.formatPrice(context.symbol, entryPrice);
      const finalEntryPrice = parseFloat(formattedEntryPrice);
      
      const confidence = 0.7; // Lower confidence for averaging down
      const formattedCurrentPrice = await BybitPrecisionFormatter.formatPrice(context.symbol, currentPrice);
      const formattedLastBoughtPrice = await BybitPrecisionFormatter.formatPrice(context.symbol, lastBoughtPrice);
      
      const reasoning = `AVERAGING DOWN: Entry at ${formattedEntryPrice} (${config.entry_offset_percent}% below current price ${formattedCurrentPrice}). Last bought: ${formattedLastBoughtPrice}`;

      return {
        shouldCreateSignal: true,
        entryPrice: finalEntryPrice,
        reasoning,
        confidence
      };
    } catch (error) {
      console.error(`❌ Error in averaging down analysis for ${context.symbol}:`, error);
      return { shouldCreateSignal: false };
    }
  }
}
