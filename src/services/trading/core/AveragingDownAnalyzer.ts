
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitInstrumentService } from './BybitInstrumentService';
import { SignalContext } from './SignalAnalysisCore';

export interface AveragingDownResult {
  shouldCreateSignal: boolean;
  entryPrice?: number;
  reasoning?: string;
  confidence?: number;
}

export class AveragingDownAnalyzer {
  analyzeAveragingDown(context: SignalContext, currentPrice: number, config: TradingConfigData): AveragingDownResult {
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

    // Place limit order below current price for averaging down
    const entryPrice = currentPrice * (1 - config.entry_offset_percent / 100);
    const formattedEntryPrice = parseFloat(BybitInstrumentService.formatPrice(context.symbol, entryPrice, context.instrumentInfo));
    
    const confidence = 0.7; // Lower confidence for averaging down
    const reasoning = `AVERAGING DOWN: Entry at ${BybitInstrumentService.formatPrice(context.symbol, formattedEntryPrice, context.instrumentInfo)} (${config.entry_offset_percent}% below current price ${BybitInstrumentService.formatPrice(context.symbol, currentPrice, context.instrumentInfo)}). Last bought: ${BybitInstrumentService.formatPrice(context.symbol, lastBoughtPrice, context.instrumentInfo)}`;

    return {
      shouldCreateSignal: true,
      entryPrice: formattedEntryPrice,
      reasoning,
      confidence
    };
  }
}
