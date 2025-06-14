import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';
import { TradeValidator } from './TradeValidator';
import { TradingLogicFactory } from './TradingLogicFactory';
import { MarketDataScannerService } from './MarketDataScannerService';

export class EnhancedSignalAnalysisService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private marketDataScanner: MarketDataScannerService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.bybitService.setLogger(this.logger);
    this.marketDataScanner = new MarketDataScannerService(userId, bybitService);
  }

  async analyzeAndCreateSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n🧠 ===== ENHANCED SIGNAL ANALYSIS START =====');
      console.log(`⚙️ Configuration Status: ${config.is_active ? 'ACTIVE' : 'INACTIVE'}`);
      
      if (!config.is_active) {
        console.log('⚠️ Trading configuration is INACTIVE - skipping signal analysis');
        await this.logger.logSystemInfo('Signal analysis skipped - configuration inactive');
        return;
      }

      console.log('🔧 Configuration Details:', {
        tradingLogicType: config.trading_logic_type,
        tradingPairs: config.trading_pairs,
        maxOrderAmount: config.max_order_amount_usd,
        takeProfitPercent: config.take_profit_percent,
        entryOffsetPercent: config.entry_offset_percent,
        supportLowerBound: config.support_lower_bound_percent,
        supportUpperBound: config.support_upper_bound_percent,
        maxPositionsPerPair: config.max_positions_per_pair,
        supportCandleCount: config.support_candle_count
      });

      // CRITICAL: Use MarketDataScannerService to ensure sufficient data FIRST
      console.log('\n🔥 STEP 1: ENSURING SUFFICIENT MARKET DATA FOR ALL SYMBOLS...');
      await this.marketDataScanner.scanMarkets(config);
      console.log('✅ STEP 1 COMPLETED: Market data verification and seeding done');

      // STEP 2: Wait a moment for data to settle
      console.log('\n⏳ STEP 2: Allowing data to settle...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get the selected trading logic with detailed logging
      console.log(`🧠 Fetching Trading Logic: ${config.trading_logic_type}`);
      const tradingLogic = TradingLogicFactory.getLogic(config.trading_logic_type);
      console.log(`✅ Trading Logic Loaded: ${tradingLogic.name}`);
      console.log(`📋 Logic Description: ${tradingLogic.description}`);
      
      // Special logging for Logic 2 deterministic features
      if (config.trading_logic_type === 'logic2_data_driven') {
        console.log('🎯 ===== LOGIC 2 DETERMINISTIC ANALYSIS =====');
        console.log('🔥 DETERMINISTIC MODE: Logic 2 WILL generate signals when market data exists');
        console.log(`📊 Swing Analysis Bars: ${config.swing_analysis_bars}`);
        console.log(`📈 Volume Lookback Periods: ${config.volume_lookback_periods}`);
        console.log(`🔢 Fibonacci Sensitivity: ${config.fibonacci_sensitivity}`);
        console.log(`📏 ATR Multiplier: ${config.atr_multiplier} (for dynamic bounds)`);
        console.log('✅ Logic 2 Parameters Confirmed - Proceeding with analysis...');
      }
      
      await this.logger.logSuccess('Starting comprehensive signal analysis', {
        tradingLogicType: config.trading_logic_type,
        tradingLogicName: tradingLogic.name,
        tradingPairsCount: config.trading_pairs.length,
        tradingPairs: config.trading_pairs,
        maxOrderAmount: config.max_order_amount_usd,
        takeProfitPercent: config.take_profit_percent,
        configDetails: {
          entryOffsetPercent: config.entry_offset_percent,
          supportBounds: {
            lower: config.support_lower_bound_percent,
            upper: config.support_upper_bound_percent
          },
          maxPositionsPerPair: config.max_positions_per_pair
        }
      });

      let analysisResults = {
        totalPairs: config.trading_pairs.length,
        analyzedPairs: 0,
        signalsGenerated: 0,
        signalsRejected: 0,
        errors: 0,
        rejectionReasons: {} as Record<string, number>,
        logic2SpecificResults: {
          supportLevelsFound: 0,
          dynamicBoundsUsed: 0,
          atrCalculations: 0
        }
      };

      for (const symbol of config.trading_pairs) {
        try {
          console.log(`\n🎯 ===== DETAILED ANALYSIS FOR ${symbol} =====`);
          console.log(`📊 ${symbol}: Starting comprehensive market analysis...`);
          analysisResults.analyzedPairs++;
          
          const result = await this.analyzeSymbolWithEnhancedLogging(symbol, config, tradingLogic);
          
          if (result.signalGenerated) {
            analysisResults.signalsGenerated++;
            console.log(`✅ ${symbol}: Signal generated successfully`);
            
            if (config.trading_logic_type === 'logic2_data_driven') {
              analysisResults.logic2SpecificResults.supportLevelsFound += result.supportLevelsFound || 0;
              if (result.usedDynamicBounds) {
                analysisResults.logic2SpecificResults.dynamicBoundsUsed++;
              }
              if (result.atrCalculated) {
                analysisResults.logic2SpecificResults.atrCalculations++;
              }
            }
          } else {
            analysisResults.signalsRejected++;
            console.log(`❌ ${symbol}: Signal rejected - ${result.reason}`);
            
            // Track rejection reasons
            const reason = result.reason || 'Unknown';
            analysisResults.rejectionReasons[reason] = (analysisResults.rejectionReasons[reason] || 0) + 1;
          }
        } catch (error) {
          analysisResults.errors++;
          console.error(`❌ Error analyzing ${symbol}:`, error);
          await this.logger.logError(`Failed to analyze ${symbol}`, error, { symbol });
        }
      }

      console.log('\n📊 ===== ENHANCED SIGNAL ANALYSIS SUMMARY =====');
      console.log('📈 Overall Results:', analysisResults);
      console.log('📋 Rejection Breakdown:', analysisResults.rejectionReasons);
      
      if (config.trading_logic_type === 'logic2_data_driven') {
        console.log('🎯 ===== LOGIC 2 SPECIFIC RESULTS =====');
        console.log('📊 Logic 2 Performance:', analysisResults.logic2SpecificResults);
        console.log(`🔥 Support Levels Found: ${analysisResults.logic2SpecificResults.supportLevelsFound}`);
        console.log(`📏 Dynamic ATR Bounds Used: ${analysisResults.logic2SpecificResults.dynamicBoundsUsed} times`);
        console.log(`🧮 ATR Calculations: ${analysisResults.logic2SpecificResults.atrCalculations}`);
        
        if (analysisResults.signalsGenerated === 0 && analysisResults.analyzedPairs > 0) {
          console.log('⚠️ LOGIC 2 WARNING: No signals generated despite deterministic nature!');
          console.log('🔍 This indicates insufficient market data or all pairs rejected due to position limits');
        }
      }
      
      await this.logger.logSuccess('Signal analysis completed', {
        ...analysisResults,
        detailedBreakdown: analysisResults.rejectionReasons,
        logic2Results: config.trading_logic_type === 'logic2_data_driven' ? analysisResults.logic2SpecificResults : null
      });
    } catch (error) {
      console.error('❌ Error in signal analysis:', error);
      await this.logger.logError('Error in signal analysis', error);
      throw error;
    }
  }

  private async analyzeSymbolWithEnhancedLogging(symbol: string, config: TradingConfigData, tradingLogic: any): Promise<{ 
    signalGenerated: boolean; 
    reason?: string;
    supportLevelsFound?: number;
    usedDynamicBounds?: boolean;
    atrCalculated?: boolean;
  }> {
    try {
      console.log(`\n🔍 ===== ENHANCED ANALYSIS FOR ${symbol} =====`);
      await this.logger.logSystemInfo(`Starting enhanced analysis for ${symbol}`);

      // Step 1: Check existing signals
      console.log(`📋 Step 1: Checking existing unprocessed signals for ${symbol}...`);
      const { data: existingSignals, error: signalsError } = await supabase
        .from('trading_signals')
        .select('id, signal_type, price, created_at')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('processed', false);

      if (signalsError) {
        console.error(`❌ Database error checking existing signals for ${symbol}:`, signalsError);
        await this.logger.logError(`Error checking existing signals for ${symbol}`, signalsError, { symbol });
        return { signalGenerated: false, reason: 'Database error checking existing signals' };
      }

      console.log(`📊 ${symbol}: Found ${existingSignals?.length || 0} existing unprocessed signals (max allowed: ${config.max_positions_per_pair})`);
      
      if (existingSignals && existingSignals.length >= config.max_positions_per_pair) {
        const rejectionReason = `Max unprocessed signals reached (${existingSignals.length}/${config.max_positions_per_pair})`;
        console.log(`⚠️ ${symbol}: ${rejectionReason}`);
        await this.logger.logSignalRejected(symbol, rejectionReason, {
          existingSignals: existingSignals.length,
          maxAllowed: config.max_positions_per_pair,
          existingSignalDetails: existingSignals
        });
        return { signalGenerated: false, reason: rejectionReason };
      }

      // Step 2: Check active positions
      console.log(`📋 Step 2: Checking active positions for ${symbol}...`);
      const { data: activeTrades, error: tradesError } = await supabase
        .from('trades')
        .select('id, status, side, price, quantity')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('side', 'buy')
        .in('status', ['pending', 'filled', 'partial_filled']);

      if (tradesError) {
        console.error(`❌ Database error checking active trades for ${symbol}:`, tradesError);
        return { signalGenerated: false, reason: 'Database error checking active trades' };
      }

      const activeTradeCount = activeTrades?.length || 0;
      console.log(`📊 ${symbol}: Found ${activeTradeCount} active trades (max allowed: ${config.max_positions_per_pair})`);
      
      if (activeTradeCount >= config.max_positions_per_pair) {
        const rejectionReason = `Max active positions reached (${activeTradeCount}/${config.max_positions_per_pair})`;
        console.log(`⚠️ ${symbol}: ${rejectionReason}`);
        await this.logger.logSignalRejected(symbol, rejectionReason, {
          activePositions: activeTradeCount,
          maxAllowed: config.max_positions_per_pair,
          activeTradeDetails: activeTrades
        });
        return { signalGenerated: false, reason: rejectionReason };
      }

      // Step 3: Get current market price
      console.log(`📊 Step 3: Getting current market price for ${symbol}...`);
      const marketData = await this.bybitService.getMarketPrice(symbol);
      const currentPrice = marketData.price;
      
      console.log(`💰 ${symbol}: Current market price: $${currentPrice.toFixed(6)}`);
      await this.logger.logMarketDataUpdate(symbol, currentPrice, 'bybit');

      // Step 4: VERIFY market data exists with multiple attempts
      console.log(`📈 Step 4: VERIFYING historical market data for ${symbol}...`);
      
      let recentData = null;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts && (!recentData || recentData.length < 10)) {
        attempts++;
        console.log(`🔍 ${symbol}: Data verification attempt ${attempts}/${maxAttempts}...`);
        
        const { data, error } = await supabase
          .from('market_data')
          .select('*')
          .eq('symbol', symbol)
          .order('timestamp', { ascending: false })
          .limit(config.support_candle_count || 128);

        if (error) {
          console.error(`❌ Database error fetching market data for ${symbol}:`, error);
          await this.logger.logError(`Error fetching market data for ${symbol}`, error, { symbol });
          return { signalGenerated: false, reason: 'Error fetching market data' };
        }

        recentData = data;
        console.log(`📊 ${symbol}: Attempt ${attempts} found ${recentData?.length || 0} records`);
        
        if (!recentData || recentData.length < 10) {
          console.log(`⚠️ ${symbol}: Insufficient data on attempt ${attempts}, waiting and retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!recentData || recentData.length < 10) {
        const rejectionReason = `CRITICAL: Still insufficient market data after ${maxAttempts} attempts (${recentData?.length || 0} records, need at least 10)`;
        console.error(`🚨 ${symbol}: ${rejectionReason}`);
        await this.logger.logError(`Critical market data verification failure for ${symbol}`, new Error(rejectionReason), {
          dataRecords: recentData?.length || 0,
          minimumRequired: 10,
          configuredCandleCount: config.support_candle_count,
          attempts: maxAttempts
        });
        return { signalGenerated: false, reason: rejectionReason };
      }

      console.log(`✅ ${symbol}: Confirmed ${recentData.length} market data records for analysis`);

      // Step 5: Convert market data to candle format
      console.log(`🔍 Step 5: Converting market data to candle format for ${symbol}...`);
      const candleData = recentData.map(d => ({
        open: parseFloat(d.price.toString()),
        high: parseFloat(d.price.toString()) * 1.001, // Simulate slight variation
        low: parseFloat(d.price.toString()) * 0.999,
        close: parseFloat(d.price.toString()),
        volume: parseFloat(d.volume?.toString() || '0'),
        timestamp: new Date(d.timestamp).getTime()
      }));

      // Step 6: Analyze support levels using selected logic with enhanced logging
      console.log(`🧠 Step 6: Analyzing support levels using ${tradingLogic.name} for ${symbol}...`);
      
      if (config.trading_logic_type === 'logic2_data_driven') {
        console.log(`🎯 ${symbol}: LOGIC 2 DETERMINISTIC ANALYSIS STARTING...`);
        console.log(`📊 Using ${config.swing_analysis_bars} bars for swing analysis`);
        console.log(`📈 Volume lookback: ${config.volume_lookback_periods} periods`);
        console.log(`🔢 Fibonacci sensitivity: ${config.fibonacci_sensitivity}`);
        console.log(`📏 ATR multiplier: ${config.atr_multiplier}`);
      }
      
      const supportLevels = tradingLogic.analyzeSupportLevels(candleData, config);
      const supportLevelsFound = supportLevels?.length || 0;

      if (!supportLevels || supportLevels.length === 0) {
        const rejectionReason = `No support levels found using ${tradingLogic.name}`;
        console.log(`❌ ${symbol}: ${rejectionReason}`);
        
        if (config.trading_logic_type === 'logic2_data_driven') {
          console.log(`🎯 ${symbol}: LOGIC 2 DETERMINISTIC FAILURE - This should not happen with sufficient data!`);
          console.log(`🔍 ${symbol}: Candle data length: ${candleData.length}, Required: ${config.swing_analysis_bars}`);
        }
        
        await this.logger.logSignalRejected(symbol, rejectionReason, {
          tradingLogic: tradingLogic.name,
          candleDataLength: candleData.length,
          supportLevelsFound: 0,
          isLogic2: config.trading_logic_type === 'logic2_data_driven'
        });
        return { signalGenerated: false, reason: rejectionReason, supportLevelsFound: 0 };
      }

      console.log(`📊 ${symbol}: Found ${supportLevels.length} support levels:`);
      supportLevels.forEach((level, index) => {
        console.log(`  ${index + 1}. Price: $${level.price.toFixed(6)}, Strength: ${level.strength.toFixed(3)}, Touches: ${level.touches}`);
      });

      // Step 7: Select best support level and check if price is in buy zone with enhanced Logic 2 logging
      const bestSupport = supportLevels[0]; // Highest ranked support
      console.log(`📐 Step 7: Checking if current price is in buy zone for ${symbol}...`);
      
      // Use dynamic bounds if Logic 2, otherwise use static bounds
      let lowerBound = config.support_lower_bound_percent;
      let upperBound = config.support_upper_bound_percent;
      let usedDynamicBounds = false;
      let atrCalculated = false;
      
      if (config.trading_logic_type === 'logic2_data_driven' && tradingLogic.calculateDynamicBounds) {
        console.log(`🎯 ${symbol}: LOGIC 2 - Calculating dynamic ATR-based bounds...`);
        const dynamicBounds = tradingLogic.calculateDynamicBounds(candleData, config);
        lowerBound = dynamicBounds.lowerBound;
        upperBound = dynamicBounds.upperBound;
        usedDynamicBounds = true;
        atrCalculated = true;
        console.log(`🎯 ${symbol}: Dynamic ATR bounds calculated - Lower: ${lowerBound.toFixed(2)}%, Upper: ${upperBound.toFixed(2)}%`);
        console.log(`📏 ${symbol}: Static bounds would have been - Lower: ${config.support_lower_bound_percent.toFixed(2)}%, Upper: ${config.support_upper_bound_percent.toFixed(2)}%`);
      }
      
      const priceAboveSupport = ((currentPrice - bestSupport.price) / bestSupport.price) * 100;
      
      console.log(`📐 ${symbol}: Price position analysis:
        - Current Price: $${currentPrice.toFixed(6)}
        - Best Support Level: $${bestSupport.price.toFixed(6)} (strength: ${bestSupport.strength.toFixed(3)})
        - Distance from Support: ${priceAboveSupport.toFixed(2)}%
        - Allowed Range: -${lowerBound.toFixed(2)}% to +${upperBound.toFixed(2)}%
        - Bounds Type: ${usedDynamicBounds ? 'DYNAMIC (ATR-based)' : 'STATIC'}
        - In Range: ${priceAboveSupport >= -lowerBound && priceAboveSupport <= upperBound ? 'YES' : 'NO'}`);

      if (priceAboveSupport < -lowerBound || priceAboveSupport > upperBound) {
        const rejectionReason = `Price not in buy zone (${priceAboveSupport.toFixed(2)}% from support, allowed: -${lowerBound.toFixed(2)}% to +${upperBound.toFixed(2)}%)`;
        console.log(`❌ ${symbol}: ${rejectionReason}`);
        await this.logger.logSignalRejected(symbol, rejectionReason, {
          currentPrice,
          supportPrice: bestSupport.price,
          distancePercent: priceAboveSupport,
          allowedRange: {
            lower: -lowerBound,
            upper: upperBound
          },
          isDynamicBounds: usedDynamicBounds,
          boundsType: usedDynamicBounds ? 'ATR-Dynamic' : 'Static'
        });
        return { 
          signalGenerated: false, 
          reason: rejectionReason, 
          supportLevelsFound,
          usedDynamicBounds,
          atrCalculated
        };
      }

      // Continue with remaining steps...
      const entryPrice = bestSupport.price * (1 + config.entry_offset_percent / 100);
      const entryPriceDistance = Math.abs((entryPrice - currentPrice) / currentPrice) * 100;
      
      if (entryPriceDistance > 5) {
        const rejectionReason = `Entry price too far from current price (${entryPriceDistance.toFixed(2)}% away, max 5%)`;
        console.log(`❌ ${symbol}: ${rejectionReason}`);
        return { 
          signalGenerated: false, 
          reason: rejectionReason, 
          supportLevelsFound,
          usedDynamicBounds,
          atrCalculated
        };
      }

      // Validate trade parameters
      const testQuantity = TradeValidator.calculateQuantity(symbol, config.max_order_amount_usd, entryPrice, config);
      
      if (!TradeValidator.validateTradeParameters(symbol, testQuantity, entryPrice, config)) {
        const rejectionReason = 'Trade parameter validation failed';
        console.log(`❌ ${symbol}: ${rejectionReason}`);
        return { 
          signalGenerated: false, 
          reason: rejectionReason, 
          supportLevelsFound,
          usedDynamicBounds,
          atrCalculated
        };
      }

      // Create buy signal
      console.log(`✅ Step 11: All validations passed, creating LIMIT buy signal for ${symbol}...`);
      if (config.trading_logic_type === 'logic2_data_driven') {
        console.log(`🎯 ${symbol}: LOGIC 2 SUCCESS - Deterministic analysis complete, signal will be created!`);
      }
      
      const signalResult = await this.createLimitBuySignal(symbol, entryPrice, bestSupport, config);
      
      return { 
        signalGenerated: signalResult, 
        reason: signalResult ? 'Signal created successfully' : 'Failed to create signal in database',
        supportLevelsFound,
        usedDynamicBounds,
        atrCalculated
      };

    } catch (error) {
      console.error(`❌ Error in enhanced analysis for ${symbol}:`, error);
      await this.logger.logError(`Failed to analyze ${symbol}`, error, { symbol });
      return { signalGenerated: false, reason: `Analysis error: ${error.message}` };
    }
  }

  private async createLimitBuySignal(symbol: string, entryPrice: number, supportLevel: any, config: TradingConfigData): Promise<boolean> {
    try {
      console.log(`📝 Creating LIMIT buy signal for ${symbol}...`);
      
      const confidence = Math.min(0.95, supportLevel.strength);
      const reasoning = `LIMIT Buy signal: Entry at $${entryPrice.toFixed(6)} (${config.entry_offset_percent}% above support $${supportLevel.price.toFixed(6)}). Support strength: ${supportLevel.strength.toFixed(3)} with ${supportLevel.touches} touches. Take profit: ${config.take_profit_percent}%`;

      console.log(`📝 ${symbol}: LIMIT signal details:
        - Order Type: LIMIT
        - Entry Price: $${entryPrice.toFixed(6)}
        - Take Profit: ${config.take_profit_percent}%
        - Confidence: ${confidence.toFixed(3)}
        - Reasoning: ${reasoning}`);

      const { data: signal, error } = await supabase
        .from('trading_signals')
        .insert({
          user_id: this.userId,
          symbol: symbol,
          signal_type: 'buy',
          price: entryPrice,
          confidence: confidence,
          reasoning: reasoning,
          processed: false
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Database error creating signal for ${symbol}:`, error);
        await this.logger.logError(`Error creating signal for ${symbol}`, error, { symbol });
        return false;
      }

      console.log(`✅ LIMIT buy signal created successfully for ${symbol}:
        - Signal ID: ${signal.id}
        - Order Type: LIMIT
        - Entry Price: $${entryPrice.toFixed(6)}
        - Take Profit: ${config.take_profit_percent}%
        - Confidence: ${confidence.toFixed(3)}
        - Support Level: $${supportLevel.price.toFixed(6)}`);
      
      await this.logger.logSignalProcessed(symbol, 'buy', {
        signalId: signal.id,
        orderType: 'LIMIT',
        entryPrice,
        takeProfitPercent: config.take_profit_percent,
        supportLevel: supportLevel.price,
        confidence: confidence,
        reasoning: reasoning,
        createdAt: signal.created_at
      });

      return true;

    } catch (error) {
      console.error(`❌ Error creating LIMIT buy signal for ${symbol}:`, error);
      await this.logger.logError(`Failed to create LIMIT buy signal for ${symbol}`, error, { symbol });
      return false;
    }
  }
}
