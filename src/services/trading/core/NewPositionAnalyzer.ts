
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';
import { SignalContext } from './SignalAnalysisCore';
import { SupportResistanceService } from './SupportResistanceService';
import { MarketDataScannerService } from './MarketDataScannerService';
import { BybitService } from '../../bybitService';

export interface NewPositionResult {
  shouldCreateSignal: boolean;
  entryPrice?: number;
  reasoning?: string;
  confidence?: number;
  supportLevel?: number;
}

export class NewPositionAnalyzer {
  private supportResistance: SupportResistanceService;
  private marketDataScanner: MarketDataScannerService;

  constructor(userId: string, bybitService: BybitService) {
    this.supportResistance = new SupportResistanceService(bybitService);
    this.marketDataScanner = new MarketDataScannerService(userId, bybitService);
  }

  async analyzeNewPosition(context: SignalContext, currentPrice: number, config: TradingConfigData): Promise<NewPositionResult> {
    if (context.isAveragingDown) {
      return { shouldCreateSignal: false };
    }

    try {
      // Ensure sufficient data
      const hasData = await Promise.race([
        this.marketDataScanner.ensureSufficientData(context.symbol, config.support_candle_count || 128),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Market data timeout')), 15000)
        )
      ]);

      if (!hasData) {
        console.warn(`⚠️ Could not ensure sufficient market data for ${context.symbol}`);
        return { shouldCreateSignal: false };
      }

      // Get support/resistance levels
      const supportData = await this.supportResistance.getSupportResistanceLevels(
        context.symbol,
        config.chart_timeframe,
        config.support_candle_count || 128,
        config.support_lower_bound_percent || 5.0,
        config.support_upper_bound_percent || 2.0
      );

      if (!supportData.currentSupport || supportData.currentSupport.price <= 0) {
        console.warn(`⚠️ No valid support level found for ${context.symbol}`);
        return { shouldCreateSignal: false };
      }

      const supportPrice = supportData.currentSupport.price;
      
      // Place limit order above support for new positions
      const entryPrice = supportPrice * (1 + config.entry_offset_percent / 100);
      const formattedEntryPrice = await BybitPrecisionFormatter.formatPrice(context.symbol, entryPrice);
      const finalEntryPrice = parseFloat(formattedEntryPrice);
      
      // Calculate confidence based on volume (higher volume = higher confidence)
      const volumeConfidence = Math.min(supportData.currentSupport.volume / 1000000, 1.0);
      const confidence = Math.min(0.95, 0.6 + (volumeConfidence * 0.3)); // Base 0.6 + volume bonus up to 0.3
      
      const formattedSupportPrice = await BybitPrecisionFormatter.formatPrice(context.symbol, supportPrice);
      const reasoning = `NEW POSITION: Entry at ${formattedEntryPrice} (${config.entry_offset_percent}% above support ${formattedSupportPrice})`;

      return {
        shouldCreateSignal: true,
        entryPrice: finalEntryPrice,
        reasoning,
        confidence,
        supportLevel: supportPrice
      };
    } catch (error) {
      console.error(`❌ Error in new position analysis for ${context.symbol}:`, error);
      return { shouldCreateSignal: false };
    }
  }
}
