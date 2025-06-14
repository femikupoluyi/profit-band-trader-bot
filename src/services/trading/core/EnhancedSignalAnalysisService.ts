import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { BybitInstrumentService } from './BybitInstrumentService';
import { TrendAnalysisService } from './TrendAnalysisService';
import { SupportResistanceService } from './SupportResistanceService';
import { MarketDataScannerService } from './MarketDataScannerService';
import { MarketDataSeeder } from './MarketDataSeeder';
import { supabase } from '@/integrations/supabase/client';

export class EnhancedSignalAnalysisService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private trendAnalysisService: TrendAnalysisService;
  private supportResistanceService: SupportResistanceService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.trendAnalysisService = new TrendAnalysisService(bybitService);
    this.supportResistanceService = new SupportResistanceService(bybitService);
  }

  async analyzeAndCreateSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n🧠 ===== ENHANCED SIGNAL ANALYSIS START =====');
      console.log(`📊 Analyzing ${config.trading_pairs.length} trading pairs`);
      console.log(`🎯 Trading Logic: ${config.trading_logic_type}`);

      // FAST INITIALIZATION: Ensure minimal market data exists before analysis
      console.log('\n🚀 STEP 0: FAST MARKET DATA CHECK...');
      const scanner = new MarketDataScannerService(this.userId, this.bybitService);
      
      // Check if we have any data at all for each symbol
      const quickChecks = await Promise.allSettled(
        config.trading_pairs.map(async (symbol) => {
          const { count } = await supabase
            .from('market_data')
            .select('*', { count: 'exact', head: true })
            .eq('symbol', symbol);
          
          return { symbol, count: count || 0 };
        })
      );

      // Only seed symbols that have insufficient data
      const symbolsNeedingData = quickChecks
        .filter((result, index) => {
          if (result.status === 'fulfilled') {
            const hasEnoughData = result.value.count >= 10; // Minimum for basic analysis
            if (!hasEnoughData) {
              console.log(`📊 ${config.trading_pairs[index]}: Only ${result.value.count} records, needs seeding`);
            }
            return !hasEnoughData;
          }
          return true;
        })
        .map((_, index) => config.trading_pairs[index]);

      if (symbolsNeedingData.length > 0) {
        console.log(`🌱 Fast seeding ${symbolsNeedingData.length} symbols with insufficient data...`);
        const seeder = new MarketDataSeeder(this.userId, this.bybitService);
        await seeder.seedInitialMarketData(symbolsNeedingData, 20); // Minimal 20 records for analysis
      } else {
        console.log('✅ All symbols have sufficient data for analysis');
      }

      // Continue with existing analysis logic...
      const analysisResults = await Promise.allSettled(
        config.trading_pairs.map(symbol => this.analyzeSymbol(symbol, config))
      );

      let successfulAnalyses = 0;
      let failedAnalyses = 0;

      for (let i = 0; i < analysisResults.length; i++) {
        const result = analysisResults[i];
        const symbol = config.trading_pairs[i];

        if (result.status === 'fulfilled') {
          successfulAnalyses++;
          console.log(`✅ ${symbol}: Analysis completed successfully`);
        } else {
          failedAnalyses++;
          console.error(`❌ ${symbol}: Analysis failed:`, result.reason);
          await this.logger.logError(`Signal analysis failed for ${symbol}`, result.reason, { symbol });
        }
      }

      console.log(`\n📊 ANALYSIS SUMMARY:`);
      console.log(`✅ Successful: ${successfulAnalyses}`);
      console.log(`❌ Failed: ${failedAnalyses}`);
      console.log(`📈 Total symbols processed: ${config.trading_pairs.length}`);

      await this.logger.logSuccess('Enhanced signal analysis completed', {
        totalSymbols: config.trading_pairs.length,
        successfulAnalyses,
        failedAnalyses,
        tradingLogicType: config.trading_logic_type
      });

      console.log('✅ ===== ENHANCED SIGNAL ANALYSIS COMPLETE =====\n');

    } catch (error) {
      console.error('❌ Error in enhanced signal analysis:', error);
      await this.logger.logError('Enhanced signal analysis failed', error);
      throw error;
    }
  }

  private async analyzeSymbol(symbol: string, config: TradingConfigData): Promise<void> {
    try {
      console.log(`\n📈 Analyzing ${symbol}...`);
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (!instrumentInfo) {
        throw new Error(`Could not fetch instrument info for ${symbol}`);
      }

      // 1. Trend Analysis
      console.log(`\n📊 [${symbol}] STEP 1: Trend Analysis`);
      const trend = await this.trendAnalysisService.getTrend(symbol, config.chart_timeframe || '4h');
      console.log(`📈 [${symbol}] Current Trend: ${trend}`);

      // 2. Support & Resistance Analysis
      console.log(`\n🔑 [${symbol}] STEP 2: Support & Resistance Analysis`);
      const supportResistance = await this.supportResistanceService.getSupportResistanceLevels(
        symbol,
        config.chart_timeframe || '4h',
        config.support_candle_count || 128,
        config.support_lower_bound_percent || 5.0,
        config.support_upper_bound_percent || 2.0
      );

      if (!supportResistance.currentSupport) {
        console.warn(`⚠️ [${symbol}] No valid support level found, skipping signal generation`);
        return;
      }

      console.log(`\n🔑 [${symbol}] Support Levels:`);
      console.log(`🔑 [${symbol}] Current Support: ${supportResistance.currentSupport.price}`);
      console.log(`🔑 [${symbol}] Lower Bound: ${supportResistance.lowerBound}`);
      console.log(`🔑 [${symbol}] Upper Bound: ${supportResistance.upperBound}`);

      // 3. Trading Logic Execution
      console.log(`\n🧠 [${symbol}] STEP 3: Trading Logic Execution`);
      switch (config.trading_logic_type) {
        case 'logic1_base':
          await this.executeBaseLogic(symbol, config, trend, supportResistance);
          break;
        case 'logic2_data_driven':
          await this.executeLogic2(symbol, config, trend, supportResistance);
          break;
        default:
          throw new Error(`Unsupported trading logic: ${config.trading_logic_type}`);
      }

      console.log(`✅ [${symbol}] Analysis completed`);

    } catch (error) {
      console.error(`❌ [${symbol}] Error analyzing symbol:`, error);
      throw error;
    }
  }

  private async executeBaseLogic(
    symbol: string,
    config: TradingConfigData,
    trend: string,
    supportResistance: {
      currentSupport: { price: number; volume: number } | null;
      lowerBound: number;
      upperBound: number;
    }
  ): Promise<void> {
    try {
      console.log(`\n⚡ [${symbol}] Executing Base Trading Logic`);

      if (!supportResistance.currentSupport) {
        console.warn(`⚠️ [${symbol}] No valid support level found, skipping signal generation`);
        return;
      }

      const currentPrice = await this.bybitService.getMarketPrice(symbol);
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);

      if (!instrumentInfo) {
        throw new Error(`Could not fetch instrument info for ${symbol}`);
      }

      const entryPrice = supportResistance.currentSupport.price * (1 + (config.entry_offset_percent || 0.5) / 100);
      const takeProfitPrice = entryPrice * (1 + (config.take_profit_percent || 2.0) / 100);

      console.log(`\n📈 [${symbol}] Signal Details:`);
      console.log(`📈 [${symbol}] Current Price: ${currentPrice.price}`);
      console.log(`📈 [${symbol}] Entry Price: ${entryPrice}`);
      console.log(`📈 [${symbol}] Take Profit Price: ${takeProfitPrice}`);
      console.log(`📈 [${symbol}] Trend: ${trend}`);

      // Check if the current price is near the entry price
      if (currentPrice.price <= entryPrice) {
        console.log(`\n✅ [${symbol}] Signal: BUY`);
        console.log(`✅ [${symbol}] Condition: Current price <= Entry Price`);
        console.log(`✅ [${symbol}] Placing buy order...`);

        // TODO: Implement order placement logic here
        console.warn(`⚠️ [${symbol}] Order placement logic not implemented yet`);
      } else {
        console.log(`\n❌ [${symbol}] No signal generated`);
        console.log(`❌ [${symbol}] Condition: Current price > Entry Price`);
      }

    } catch (error) {
      console.error(`❌ [${symbol}] Error executing base trading logic:`, error);
      throw error;
    }
  }

  private async executeLogic2(
    symbol: string,
    config: TradingConfigData,
    trend: string,
    supportResistance: {
      currentSupport: { price: number; volume: number } | null;
      lowerBound: number;
      upperBound: number;
    }
  ): Promise<void> {
    try {
      console.log(`\n🔥 [${symbol}] Executing Logic 2 - Data Driven`);
      console.log(`🔥 [${symbol}] Swing Analysis Bars: ${config.swing_analysis_bars}`);
      console.log(`🔥 [${symbol}] Volume Lookback Periods: ${config.volume_lookback_periods}`);
      console.log(`🔥 [${symbol}] Fibonacci Sensitivity: ${config.fibonacci_sensitivity}`);
      console.log(`🔥 [${symbol}] ATR Multiplier: ${config.atr_multiplier}`);

      if (!supportResistance.currentSupport) {
        console.warn(`⚠️ [${symbol}] No valid support level found, skipping signal generation`);
        return;
      }

      const currentPrice = await this.bybitService.getMarketPrice(symbol);
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);

      if (!instrumentInfo) {
        throw new Error(`Could not fetch instrument info for ${symbol}`);
      }

      // 1. Swing Low Analysis
      console.log(`\n📊 [${symbol}] STEP 1: Swing Low Analysis`);
      const swingAnalysisBars = config.swing_analysis_bars || 20;
      const swingLow = await this.findSwingLow(symbol, swingAnalysisBars);

      if (!swingLow) {
        console.warn(`⚠️ [${symbol}] No swing low found within ${swingAnalysisBars} bars`);
        return;
      }

      console.log(`\n📊 [${symbol}] Swing Low Details:`);
      console.log(`📊 [${symbol}] Price: ${swingLow.lowPrice}`);
      console.log(`📊 [${symbol}] Timestamp: ${swingLow.timestamp}`);

      // 2. Volume Profile Analysis
      console.log(`\n📈 [${symbol}] STEP 2: Volume Profile Analysis`);
      const volumeLookbackPeriods = config.volume_lookback_periods || 50;
      const volumeProfile = await this.getVolumeProfile(symbol, volumeLookbackPeriods);

      if (!volumeProfile) {
        console.warn(`⚠️ [${symbol}] No volume profile data found within ${volumeLookbackPeriods} periods`);
        return;
      }

      console.log(`\n📈 [${symbol}] Volume Profile Details:`);
      console.log(`📈 [${symbol}] High Volume Node: ${volumeProfile.highVolumeNode}`);
      console.log(`📈 [${symbol}] Low Volume Node: ${volumeProfile.lowVolumeNode}`);

      // 3. Fibonacci Retracement Levels
      console.log(`\n🔢 [${symbol}] STEP 3: Fibonacci Retracement Levels`);
      const fibonacciSensitivity = config.fibonacci_sensitivity || 0.618;
      const fibonacciLevels = this.calculateFibonacciRetracementLevels(swingLow.lowPrice, currentPrice.price, fibonacciSensitivity);

      console.log(`\n🔢 [${symbol}] Fibonacci Retracement Levels:`);
      console.log(`🔢 [${symbol}] 38.2%: ${fibonacciLevels['38.2']}`);
      console.log(`🔢 [${symbol}] 61.8%: ${fibonacciLevels['61.8']}`);

      // 4. ATR-Based Volatility Check
      console.log(`\n📏 [${symbol}] STEP 4: ATR-Based Volatility Check`);
      const atrMultiplier = config.atr_multiplier || 1.0;
      const atrValue = await this.getATR(symbol, 14); // Standard ATR period
      const volatilityThreshold = atrValue * atrMultiplier;

      console.log(`\n📏 [${symbol}] ATR Details:`);
      console.log(`📏 [${symbol}] ATR Value: ${atrValue}`);
      console.log(`📏 [${symbol}] Volatility Threshold: ${volatilityThreshold}`);

      // 5. Signal Generation Logic
      console.log(`\n🧠 [${symbol}] STEP 5: Signal Generation Logic`);
      const entryPrice = supportResistance.currentSupport.price * (1 + (config.entry_offset_percent || 0.5) / 100);
      const takeProfitPrice = entryPrice * (1 + (config.take_profit_percent || 2.0) / 100);

      console.log(`\n📈 [${symbol}] Signal Details:`);
      console.log(`📈 [${symbol}] Current Price: ${currentPrice.price}`);
      console.log(`📈 [${symbol}] Entry Price: ${entryPrice}`);
      console.log(`📈 [${symbol}] Take Profit Price: ${takeProfitPrice}`);
      console.log(`📈 [${symbol}] Trend: ${trend}`);

      // Conditions for BUY signal
      const isPriceNearSupport = currentPrice.price <= entryPrice;
      const isFibonacciLevelReached = currentPrice.price <= fibonacciLevels['61.8'];
      const isVolatilityAcceptable = atrValue <= volatilityThreshold;

      if (isPriceNearSupport && isFibonacciLevelReached && isVolatilityAcceptable) {
        console.log(`\n✅ [${symbol}] Signal: BUY`);
        console.log(`✅ [${symbol}] Condition: Current price <= Entry Price`);
        console.log(`✅ [${symbol}] Condition: Fibonacci level reached`);
        console.log(`✅ [${symbol}] Condition: Volatility is acceptable`);
        console.log(`✅ [${symbol}] Placing buy order...`);

        // TODO: Implement order placement logic here
        console.warn(`⚠️ [${symbol}] Order placement logic not implemented yet`);
      } else {
        console.log(`\n❌ [${symbol}] No signal generated`);
        console.log(`❌ [${symbol}] Condition: Current price > Entry Price: ${!isPriceNearSupport}`);
        console.log(`❌ [${symbol}] Condition: Fibonacci level not reached: ${!isFibonacciLevelReached}`);
        console.log(`❌ [${symbol}] Condition: Volatility is too high: ${!isVolatilityAcceptable}`);
      }

    } catch (error) {
      console.error(`❌ [${symbol}] Error executing Logic 2:`, error);
      throw error;
    }
  }

  private async findSwingLow(symbol: string, swingAnalysisBars: number): Promise<{ lowPrice: number; timestamp: string } | null> {
    try {
      console.log(`\n📊 [${symbol}] Finding swing low within ${swingAnalysisBars} bars`);

      const now = Date.now();
      const fiveMinutesInMillis = 5 * 60 * 1000;
      const startTime = new Date(now - (swingAnalysisBars * fiveMinutesInMillis)).toISOString();

      const { data, error } = await supabase
        .from('market_data')
        .select('timestamp, price')
        .eq('symbol', symbol)
        .gte('timestamp', startTime)
        .order('price', { ascending: true })
        .limit(1);

      if (error) {
        console.error(`❌ [${symbol}] Error fetching market data for swing low analysis:`, error);
        return null;
      }

      if (!data || data.length === 0) {
        console.warn(`⚠️ [${symbol}] No market data found within the specified range for swing low analysis`);
        return null;
      }

      const swingLow = {
        lowPrice: data[0].price,
        timestamp: data[0].timestamp
      };

      console.log(`\n📊 [${symbol}] Swing Low Details:`);
      console.log(`📊 [${symbol}] Price: ${swingLow.lowPrice}`);
      console.log(`📊 [${symbol}] Timestamp: ${swingLow.timestamp}`);

      return swingLow;

    } catch (error) {
      console.error(`❌ [${symbol}] Error finding swing low:`, error);
      return null;
    }
  }

  private async getVolumeProfile(symbol: string, volumeLookbackPeriods: number): Promise<{ highVolumeNode: number; lowVolumeNode: number } | null> {
    try {
      console.log(`\n📈 [${symbol}] Getting volume profile within ${volumeLookbackPeriods} periods`);

      const now = Date.now();
      const fiveMinutesInMillis = 5 * 60 * 1000;
      const startTime = new Date(now - (volumeLookbackPeriods * fiveMinutesInMillis)).toISOString();

      const { data, error } = await supabase
        .from('market_data')
        .select('price, volume')
        .eq('symbol', symbol)
        .gte('timestamp', startTime)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error(`❌ [${symbol}] Error fetching market data for volume profile analysis:`, error);
        return null;
      }

      if (!data || data.length === 0) {
        console.warn(`⚠️ [${symbol}] No market data found within the specified range for volume profile analysis`);
        return null;
      }

      // Calculate volume profile
      let highVolumeNode = 0;
      let lowVolumeNode = Infinity;
      let totalVolume = 0;

      for (const record of data) {
        totalVolume += record.volume;
        if (record.volume > highVolumeNode) {
          highVolumeNode = record.volume;
        }
        if (record.volume < lowVolumeNode) {
          lowVolumeNode = record.volume;
        }
      }

      const volumeProfile = {
        highVolumeNode,
        lowVolumeNode
      };

      console.log(`\n📈 [${symbol}] Volume Profile Details:`);
      console.log(`📈 [${symbol}] High Volume Node: ${volumeProfile.highVolumeNode}`);
      console.log(`📈 [${symbol}] Low Volume Node: ${volumeProfile.lowVolumeNode}`);

      return volumeProfile;

    } catch (error) {
      console.error(`❌ [${symbol}] Error getting volume profile:`, error);
      return null;
    }
  }

  private calculateFibonacciRetracementLevels(swingLow: number, currentPrice: number, sensitivity: number): { [key: string]: number } {
    const diff = currentPrice - swingLow;
    return {
      '23.6': currentPrice - (diff * 0.236 * sensitivity),
      '38.2': currentPrice - (diff * 0.382 * sensitivity),
      '50': currentPrice - (diff * 0.5 * sensitivity),
      '61.8': currentPrice - (diff * 0.618 * sensitivity),
      '78.6': currentPrice - (diff * 0.786 * sensitivity)
    };
  }

  private async getATR(symbol: string, period: number): Promise<number> {
    try {
      console.log(`\n📏 [${symbol}] Getting ATR with period ${period}`);

      // Fetch recent market data
      const now = Date.now();
      const fiveMinutesInMillis = 5 * 60 * 1000;
      const startTime = new Date(now - (period * fiveMinutesInMillis)).toISOString();

      const { data, error } = await supabase
        .from('market_data')
        .select('price')
        .eq('symbol', symbol)
        .gte('timestamp', startTime)
        .order('timestamp', { ascending: false })
        .limit(period);

      if (error) {
        console.error(`❌ [${symbol}] Error fetching market data for ATR calculation:`, error);
        return 0;
      }

      if (!data || data.length < period) {
        console.warn(`⚠️ [${symbol}] Insufficient market data for ATR calculation (required ${period}, got ${data?.length || 0})`);
        return 0;
      }

      // Calculate True Range (TR) values
      let trSum = 0;
      for (let i = 1; i < data.length; i++) {
        const high = data[i - 1].price;
        const low = data[i].price;
        const closePrevious = data[i].price;

        const highLow = high - low;
        const highClosePrevious = Math.abs(high - closePrevious);
        const lowClosePrevious = Math.abs(low - closePrevious);

        const tr = Math.max(highLow, highClosePrevious, lowClosePrevious);
        trSum += tr;
      }

      // Calculate ATR
      const atr = trSum / period;

      console.log(`\n📏 [${symbol}] ATR Details:`);
      console.log(`📏 [${symbol}] ATR Value: ${atr}`);

      return atr;

    } catch (error) {
      console.error(`❌ [${symbol}] Error getting ATR:`, error);
      return 0;
    }
  }
}
