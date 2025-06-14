import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';
import { TradeValidator } from './TradeValidator';
import { TradingLogicFactory } from './TradingLogicFactory';

export class SignalAnalysisService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.bybitService.setLogger(this.logger);
  }

  async analyzeAndCreateSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n📈 ===== SIGNAL ANALYSIS START =====');
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

      // Get the selected trading logic
      const tradingLogic = TradingLogicFactory.getLogic(config.trading_logic_type);
      console.log(`🧠 Using Trading Logic: ${tradingLogic.name}`);
      console.log(`📋 Logic Description: ${tradingLogic.description}`);
      
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
        rejectionReasons: {} as Record<string, number>
      };

      for (const symbol of config.trading_pairs) {
        try {
          console.log(`\n🎯 ===== STARTING ANALYSIS FOR ${symbol} =====`);
          analysisResults.analyzedPairs++;
          const result = await this.analyzeSymbol(symbol, config, tradingLogic);
          if (result.signalGenerated) {
            analysisResults.signalsGenerated++;
            console.log(`✅ ${symbol}: Signal generated successfully`);
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

      console.log('\n📊 ===== SIGNAL ANALYSIS SUMMARY =====');
      console.log('📈 Overall Results:', analysisResults);
      console.log('📋 Rejection Breakdown:', analysisResults.rejectionReasons);
      
      await this.logger.logSuccess('Signal analysis completed', {
        ...analysisResults,
        detailedBreakdown: analysisResults.rejectionReasons
      });
    } catch (error) {
      console.error('❌ Error in signal analysis:', error);
      await this.logger.logError('Error in signal analysis', error);
      throw error;
    }
  }

  private async analyzeSymbol(symbol: string, config: TradingConfigData, tradingLogic: any): Promise<{ signalGenerated: boolean; reason?: string }> {
    try {
      console.log(`\n🔍 ===== DETAILED ANALYSIS FOR ${symbol} =====`);
      await this.logger.logSystemInfo(`Starting detailed analysis for ${symbol}`);

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

      // Step 4: Get recent market data for support analysis
      console.log(`📈 Step 4: Fetching historical market data for ${symbol}...`);
      const { data: recentData, error } = await supabase
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

      if (!recentData || recentData.length < 10) {
        const rejectionReason = `Insufficient market data (${recentData?.length || 0} records, need at least 10)`;
        console.log(`⚠️ ${symbol}: ${rejectionReason}`);
        await this.logger.logSignalRejected(symbol, rejectionReason, {
          dataRecords: recentData?.length || 0,
          minimumRequired: 10,
          configuredCandleCount: config.support_candle_count
        });
        return { signalGenerated: false, reason: rejectionReason };
      }

      console.log(`📊 ${symbol}: Found ${recentData.length} market data records for analysis`);

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

      // Step 6: Analyze support levels using selected logic
      console.log(`🧠 Step 6: Analyzing support levels using ${tradingLogic.name} for ${symbol}...`);
      const supportLevels = tradingLogic.analyzeSupportLevels(candleData, config);

      if (!supportLevels || supportLevels.length === 0) {
        const rejectionReason = `No support levels found using ${tradingLogic.name}`;
        console.log(`❌ ${symbol}: ${rejectionReason}`);
        await this.logger.logSignalRejected(symbol, rejectionReason, {
          tradingLogic: tradingLogic.name,
          candleDataLength: candleData.length,
          supportLevelsFound: 0
        });
        return { signalGenerated: false, reason: rejectionReason };
      }

      console.log(`📊 ${symbol}: Found ${supportLevels.length} support levels:`);
      supportLevels.forEach((level, index) => {
        console.log(`  ${index + 1}. Price: $${level.price.toFixed(6)}, Strength: ${level.strength.toFixed(3)}, Touches: ${level.touches}`);
      });

      // Step 7: Select best support level and check if price is in buy zone
      const bestSupport = supportLevels[0]; // Highest ranked support
      console.log(`📐 Step 7: Checking if current price is in buy zone for ${symbol}...`);
      
      // Use dynamic bounds if Logic 2, otherwise use static bounds
      let lowerBound = config.support_lower_bound_percent;
      let upperBound = config.support_upper_bound_percent;
      
      if (config.trading_logic_type === 'logic2_data_driven' && tradingLogic.calculateDynamicBounds) {
        const dynamicBounds = tradingLogic.calculateDynamicBounds(candleData, config);
        lowerBound = dynamicBounds.lowerBound;
        upperBound = dynamicBounds.upperBound;
        console.log(`🎯 ${symbol}: Using dynamic ATR-based bounds - Lower: ${lowerBound.toFixed(2)}%, Upper: ${upperBound.toFixed(2)}%`);
      }
      
      const priceAboveSupport = ((currentPrice - bestSupport.price) / bestSupport.price) * 100;
      
      console.log(`📐 ${symbol}: Price position analysis:
        - Current Price: $${currentPrice.toFixed(6)}
        - Best Support Level: $${bestSupport.price.toFixed(6)} (strength: ${bestSupport.strength.toFixed(3)})
        - Distance from Support: ${priceAboveSupport.toFixed(2)}%
        - Allowed Range: -${lowerBound.toFixed(2)}% to +${upperBound.toFixed(2)}%
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
          isDynamicBounds: config.trading_logic_type === 'logic2_data_driven'
        });
        return { signalGenerated: false, reason: rejectionReason };
      }

      // Step 8: Calculate entry price
      console.log(`🎯 Step 8: Calculating entry price for ${symbol}...`);
      const entryPrice = bestSupport.price * (1 + config.entry_offset_percent / 100);
      console.log(`🎯 ${symbol}: Entry price calculation:
        - Support Price: $${bestSupport.price.toFixed(6)}
        - Entry Offset: ${config.entry_offset_percent}%
        - Calculated Entry: $${entryPrice.toFixed(6)}`);
      
      // Step 9: Validate entry price makes sense
      console.log(`🔧 Step 9: Validating entry price reasonableness for ${symbol}...`);
      const entryPriceDistance = Math.abs((entryPrice - currentPrice) / currentPrice) * 100;
      console.log(`🔧 ${symbol}: Entry price validation:
        - Entry Price: $${entryPrice.toFixed(6)}
        - Current Price: $${currentPrice.toFixed(6)}
        - Distance: ${entryPriceDistance.toFixed(2)}%
        - Max Allowed Distance: 5%`);
        
      if (entryPriceDistance > 5) {
        const rejectionReason = `Entry price too far from current price (${entryPriceDistance.toFixed(2)}% away, max 5%)`;
        console.log(`❌ ${symbol}: ${rejectionReason}`);
        await this.logger.logSignalRejected(symbol, rejectionReason, {
          entryPrice,
          currentPrice,
          distancePercent: entryPriceDistance,
          maxAllowedDistance: 5
        });
        return { signalGenerated: false, reason: rejectionReason };
      }

      // Step 10: Validate trade parameters with proper async handling
      console.log(`🔧 Step 10: Validating trade parameters for ${symbol}...`);
      const testQuantity = await TradeValidator.calculateQuantity(symbol, config.max_order_amount_usd, entryPrice, config);
      const orderValue = testQuantity * entryPrice;
      
      console.log(`🔧 ${symbol}: Trade parameter validation:
        - Max Order Amount: $${config.max_order_amount_usd}
        - Entry Price: $${entryPrice.toFixed(6)}
        - Calculated Quantity: ${testQuantity}
        - Order Value: $${orderValue.toFixed(2)}`);
      
      const isValidTrade = await TradeValidator.validateTradeParameters(symbol, testQuantity, entryPrice, config);
      if (!isValidTrade) {
        const rejectionReason = 'Trade parameter validation failed';
        console.log(`❌ ${symbol}: ${rejectionReason}`);
        await this.logger.logSignalRejected(symbol, rejectionReason, {
          entryPrice,
          testQuantity,
          orderValue,
          maxOrderAmount: config.max_order_amount_usd
        });
        return { signalGenerated: false, reason: rejectionReason };
      }

      // Step 11: Create buy signal with limit order
      console.log(`✅ Step 11: All validations passed, creating LIMIT buy signal for ${symbol}...`);
      const signalResult = await this.createLimitBuySignal(symbol, entryPrice, bestSupport, config);
      
      if (signalResult) {
        console.log(`🎉 ${symbol}: LIMIT buy signal created successfully!`);
      } else {
        console.log(`❌ ${symbol}: Failed to create buy signal in database`);
      }
      
      return { signalGenerated: signalResult, reason: signalResult ? 'Signal created successfully' : 'Failed to create signal in database' };

    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
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
