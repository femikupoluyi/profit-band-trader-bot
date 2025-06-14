
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { MarketDataScannerService } from './MarketDataScannerService';
import { TradeValidator } from './TradeValidator';
import { TrendAnalysisService } from './TrendAnalysisService';
import { SupportResistanceService } from './SupportResistanceService';
import { BybitInstrumentService } from './BybitInstrumentService';

export interface SignalAnalysisResult {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  entryPrice: number;
  quantity: number;
  reasoning: string;
  supportLevel?: number;
  trend?: string;
  orderValue: number;
}

export class EnhancedSignalAnalysisService {
  private marketDataScanner: MarketDataScannerService;
  private trendAnalysis: TrendAnalysisService;
  private supportResistance: SupportResistanceService;
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.marketDataScanner = new MarketDataScannerService(userId, bybitService);
    this.trendAnalysis = new TrendAnalysisService(bybitService);
    this.supportResistance = new SupportResistanceService(bybitService);
  }

  async analyzeSignal(symbol: string, config: TradingConfigData): Promise<SignalAnalysisResult | null> {
    try {
      console.log(`🔍 Starting enhanced analysis for ${symbol}`);

      // Ensure sufficient market data with timeout
      const hasData = await Promise.race([
        this.marketDataScanner.ensureSufficientData(
          symbol, 
          config.support_candle_count || 128
        ),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Market data timeout')), 15000)
        )
      ]);

      if (!hasData) {
        console.warn(`⚠️ Could not ensure sufficient market data for ${symbol}`);
        return null;
      }

      // Get current market price
      const marketPrice = await this.bybitService.getMarketPrice(symbol);
      if (!marketPrice || !marketPrice.price || marketPrice.price <= 0) {
        console.error(`❌ Invalid market price for ${symbol}`);
        return null;
      }

      const currentPrice = marketPrice.price;

      // Perform trend analysis
      const trend = await this.trendAnalysis.getTrend(symbol, config.chart_timeframe);

      // Get support/resistance levels
      const supportData = await this.supportResistance.getSupportResistanceLevels(
        symbol,
        config.chart_timeframe,
        config.support_candle_count || 128,
        config.support_lower_bound_percent || 5.0,
        config.support_upper_bound_percent || 2.0
      );

      // Only proceed if we have valid support data
      if (!supportData.currentSupport || supportData.currentSupport.price <= 0) {
        console.warn(`⚠️ No valid support level found for ${symbol}`);
        return null;
      }

      const supportPrice = supportData.currentSupport.price;
      const lowerBound = supportData.lowerBound;
      const upperBound = supportData.upperBound;

      console.log(`📊 Analysis for ${symbol}:`, {
        currentPrice: currentPrice.toFixed(6),
        supportPrice: supportPrice.toFixed(6),
        trend,
        lowerBound: lowerBound.toFixed(6),
        upperBound: upperBound.toFixed(6)
      });

      // Enhanced signal logic
      let action: 'buy' | 'sell' | 'hold' = 'hold';
      let confidence = 0;
      let reasoning = '';

      // Check if price is near support with bullish conditions
      if (currentPrice >= lowerBound && currentPrice <= upperBound) {
        if (trend === 'bullish' || trend === 'neutral') {
          action = 'buy';
          confidence = trend === 'bullish' ? 0.8 : 0.6;
          reasoning = `Price ${currentPrice.toFixed(6)} near support ${supportPrice.toFixed(6)} with ${trend} trend`;
        }
      }

      if (action === 'hold') {
        return {
          symbol,
          action,
          confidence: 0,
          entryPrice: currentPrice,
          quantity: 0,
          reasoning: `No favorable entry conditions. Price: ${currentPrice.toFixed(6)}, Support: ${supportPrice.toFixed(6)}, Trend: ${trend}`,
          supportLevel: supportPrice,
          trend,
          orderValue: 0
        };
      }

      // Calculate entry price with proper formatting
      const entryOffset = (config.entry_offset_percent || 0.5) / 100;
      let entryPrice = supportPrice * (1 - entryOffset);

      // Get instrument info for proper formatting
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (instrumentInfo) {
        // Format entry price according to instrument precision
        entryPrice = parseFloat(BybitInstrumentService.formatPrice(symbol, entryPrice, instrumentInfo));
      }

      // Calculate quantity using proper validation
      const quantity = await TradeValidator.calculateQuantity(
        symbol,
        config.max_order_amount_usd || 100,
        entryPrice,
        config
      );

      // Validate the trade parameters
      const isValid = await TradeValidator.validateTradeParameters(symbol, quantity, entryPrice, config);
      if (!isValid) {
        console.error(`❌ Trade validation failed for ${symbol}`);
        return null;
      }

      const orderValue = quantity * entryPrice;

      console.log(`✅ Generated ${action.toUpperCase()} signal for ${symbol}:`, {
        entryPrice: entryPrice.toFixed(instrumentInfo?.priceDecimals || 6),
        quantity: quantity.toFixed(instrumentInfo?.quantityDecimals || 6),
        orderValue: orderValue.toFixed(2),
        confidence
      });

      return {
        symbol,
        action,
        confidence,
        entryPrice,
        quantity,
        reasoning,
        supportLevel: supportPrice,
        trend,
        orderValue
      };

    } catch (error) {
      console.error(`❌ Error in enhanced signal analysis for ${symbol}:`, error);
      return null;
    }
  }
}
