
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { SupportResistanceService } from './SupportResistanceService';
import { DataDrivenSupportAnalyzer } from './DataDrivenSupportAnalyzer';
import { CandleDataService } from '../candleDataService';
import { SupportLevelProcessor } from './SupportLevelProcessor';

interface SupportAnalysisResult {
  isValid: boolean;
  supportLevel?: number;
  strength?: number;
  touchCount?: number;
  reason?: string;
}

export class SupportAnalysisService {
  private userId: string;
  private bybitService: BybitService;
  private supportResistanceService: SupportResistanceService;
  private dataDrivenAnalyzer: DataDrivenSupportAnalyzer;
  private candleDataService: CandleDataService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.supportResistanceService = new SupportResistanceService(bybitService);
    this.dataDrivenAnalyzer = new DataDrivenSupportAnalyzer();
    this.candleDataService = new CandleDataService();
  }

  async performEnhancedSupportAnalysis(symbol: string, currentPrice: number, config: TradingConfigData): Promise<SupportAnalysisResult> {
    try {
      console.log(`🔍 Performing ENHANCED ${config.trading_logic_type} support analysis for ${symbol}`);

      // Method 1: Data-driven analysis
      const candleDataResult = await this.tryDataDrivenAnalysis(symbol, currentPrice, config);
      if (candleDataResult.isValid) {
        console.log(`✅ Data-driven analysis successful for ${symbol}`);
        return candleDataResult;
      }

      // Method 2: Support/Resistance service
      const serviceResult = await this.trySupportResistanceService(symbol, currentPrice, config);
      if (serviceResult.isValid) {
        console.log(`✅ Support/Resistance service successful for ${symbol}`);
        return serviceResult;
      }

      // Method 3: Enhanced fallback
      const fallbackResult = await this.performEnhancedFallbackAnalysis(symbol, currentPrice, config);
      if (fallbackResult.isValid) {
        console.log(`✅ Enhanced fallback analysis successful for ${symbol}`);
        return fallbackResult;
      }

      return { isValid: false, reason: 'All support analysis methods failed' };
      
    } catch (error) {
      console.error(`❌ Error in enhanced support analysis for ${symbol}:`, error);
      return { isValid: false, reason: `Analysis error: ${error.message}` };
    }
  }

  private async tryDataDrivenAnalysis(symbol: string, currentPrice: number, config: TradingConfigData): Promise<SupportAnalysisResult> {
    try {
      console.log(`🧠 Attempting data-driven analysis for ${symbol}`);
      
      const candleCount = Math.max(config.support_candle_count || 128, 128);
      const candles = await this.candleDataService.getCandleData(symbol, candleCount);
      
      if (candles.length < 50) {
        console.warn(`⚠️ Insufficient candle data for ${symbol}: ${candles.length} candles`);
        return { isValid: false, reason: `Insufficient candle data: ${candles.length} candles` };
      }

      const supportLevels = this.dataDrivenAnalyzer.analyzeSupport(candles, {
        ...config,
        swing_analysis_bars: Math.max(config.swing_analysis_bars || 20, 20),
        volume_lookback_periods: Math.max(config.volume_lookback_periods || 50, 50)
      });
      
      if (supportLevels.length === 0) {
        console.log(`📊 No support levels found by data-driven analysis for ${symbol}`);
        return { isValid: false, reason: 'No data-driven support levels identified' };
      }

      for (const support of supportLevels) {
        const distancePercent = ((currentPrice - support.price) / currentPrice) * 100;
        
        if (distancePercent >= 0.1 && distancePercent <= 25) {
          console.log(`📈 Valid data-driven support for ${symbol}: $${support.price.toFixed(6)}`);
          
          return {
            isValid: true,
            supportLevel: support.price,
            strength: support.strength,
            touchCount: support.touches
          };
        }
      }

      return { isValid: false, reason: 'No suitable data-driven support levels within acceptable range' };
      
    } catch (error) {
      console.error(`❌ Data-driven analysis failed for ${symbol}:`, error);
      return { isValid: false, reason: `Data-driven analysis error: ${error.message}` };
    }
  }

  private async trySupportResistanceService(symbol: string, currentPrice: number, config: TradingConfigData): Promise<SupportAnalysisResult> {
    try {
      console.log(`🔑 Attempting SupportResistanceService for ${symbol}`);
      
      const analysis = await this.supportResistanceService.getSupportResistanceLevels(
        symbol,
        config.chart_timeframe || '4h',
        Math.max(config.support_candle_count || 128, 128),
        Math.max(config.support_lower_bound_percent || 5.0, 5.0),
        config.support_upper_bound_percent || 2.0
      );

      if (!analysis.currentSupport) {
        console.log(`📊 No support found by SupportResistanceService for ${symbol}`);
        return { isValid: false, reason: 'No support levels identified from service' };
      }

      const supportLevel = analysis.currentSupport.price;
      const distancePercent = ((currentPrice - supportLevel) / currentPrice) * 100;
      
      if (distancePercent < 0.1 || distancePercent > 20) {
        console.log(`📊 Support level for ${symbol} outside acceptable range: ${distancePercent.toFixed(2)}%`);
        return { isValid: false, reason: `Support level distance ${distancePercent.toFixed(2)}% outside acceptable range` };
      }
      
      const strength = Math.min(0.9, 0.4 + (analysis.currentSupport.volume / 2000000) * 0.5);
      
      console.log(`🔑 Valid SupportResistanceService support for ${symbol}: $${supportLevel.toFixed(6)}`);

      return {
        isValid: true,
        supportLevel,
        strength,
        touchCount: 3
      };

    } catch (error) {
      console.error(`❌ SupportResistanceService failed for ${symbol}:`, error);
      return { isValid: false, reason: `Service error: ${error.message}` };
    }
  }

  private async performEnhancedFallbackAnalysis(symbol: string, currentPrice: number, config: TradingConfigData): Promise<SupportAnalysisResult> {
    try {
      console.log(`📊 Attempting enhanced fallback analysis for ${symbol}`);
      
      const supportPercent = Math.max(config.support_lower_bound_percent || 5.0, 2.0);
      const supportLevel = currentPrice * (1 - supportPercent / 100);
      
      const formattedSupportLevel = await SupportLevelProcessor.formatSupportLevel(symbol, supportLevel);
      
      console.log(`📈 Enhanced fallback support for ${symbol}: $${formattedSupportLevel.toFixed(6)}`);

      return {
        isValid: true,
        supportLevel: formattedSupportLevel,
        strength: 0.7,
        touchCount: 2,
        reason: `Enhanced fallback: ${supportPercent}% below current price`
      };

    } catch (error) {
      console.error(`❌ Enhanced fallback analysis failed for ${symbol}:`, error);
      return { isValid: false, reason: `Enhanced fallback error: ${error.message}` };
    }
  }
}
