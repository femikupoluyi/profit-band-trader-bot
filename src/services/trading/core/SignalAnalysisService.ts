
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SupportLevelAnalyzer } from '../supportLevelAnalyzer';
import { TradingLogger } from './TradingLogger';
import { TradeValidator } from './TradeValidator';

export class SignalAnalysisService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private supportLevelAnalyzer: SupportLevelAnalyzer;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.bybitService.setLogger(this.logger);
    this.supportLevelAnalyzer = new SupportLevelAnalyzer();
  }

  async analyzeAndCreateSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n📈 ===== SIGNAL ANALYSIS START =====');
      console.log('🔧 Configuration Details:', {
        tradingPairs: config.trading_pairs,
        maxOrderAmount: config.max_order_amount_usd,
        takeProfitPercent: config.take_profit_percent,
        entryOffsetPercent: config.entry_offset_percent,
        supportLowerBound: config.support_lower_bound_percent,
        supportUpperBound: config.support_upper_bound_percent,
        maxPositionsPerPair: config.max_positions_per_pair,
        supportCandleCount: config.support_candle_count
      });
      
      await this.logger.logSuccess('Starting comprehensive signal analysis', {
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
          const result = await this.analyzeSymbol(symbol, config);
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

  private async analyzeSymbol(symbol: string, config: TradingConfigData): Promise<{ signalGenerated: boolean; reason?: string }> {
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

      // Step 5: Analyze support levels
      console.log(`🔍 Step 5: Analyzing support levels for ${symbol}...`);
      const priceHistory = recentData.map(d => parseFloat(d.price.toString()));
      console.log(`📈 ${symbol}: Price range in data: $${Math.min(...priceHistory).toFixed(6)} - $${Math.max(...priceHistory).toFixed(6)}`);
      
      const supportLevel = this.supportLevelAnalyzer.identifySupportLevel(
        priceHistory.map((price, index) => ({
          low: price,
          high: price,
          open: price,
          close: price,
          volume: 0,
          timestamp: Date.now() - (index * 1000)
        }))
      );

      if (!supportLevel || supportLevel.strength <= 0.3) {
        const rejectionReason = `No valid support level found (strength: ${supportLevel?.strength || 'N/A'})`;
        console.log(`❌ ${symbol}: ${rejectionReason}`);
        await this.logger.logSignalRejected(symbol, rejectionReason, {
          supportLevel: supportLevel?.price || null,
          strength: supportLevel?.strength || 0,
          minimumStrength: 0.3,
          priceRange: { min: Math.min(...priceHistory), max: Math.max(...priceHistory) }
        });
        return { signalGenerated: false, reason: rejectionReason };
      }

      console.log(`📊 ${symbol}: Support level analysis:
        - Support Price: $${supportLevel.price.toFixed(6)}
        - Strength: ${supportLevel.strength.toFixed(3)}
        - Touches: ${supportLevel.touches}`);
      
      // Step 6: Check if price is in buy zone
      console.log(`📐 Step 6: Checking if current price is in buy zone for ${symbol}...`);
      const priceAboveSupport = ((currentPrice - supportLevel.price) / supportLevel.price) * 100;
      
      console.log(`📐 ${symbol}: Price position analysis:
        - Current Price: $${currentPrice.toFixed(6)}
        - Support Level: $${supportLevel.price.toFixed(6)}
        - Distance from Support: ${priceAboveSupport.toFixed(2)}%
        - Allowed Range: -${config.support_lower_bound_percent}% to +${config.support_upper_bound_percent}%
        - In Range: ${priceAboveSupport >= -config.support_lower_bound_percent && priceAboveSupport <= config.support_upper_bound_percent ? 'YES' : 'NO'}`);

      if (priceAboveSupport < -config.support_lower_bound_percent || priceAboveSupport > config.support_upper_bound_percent) {
        const rejectionReason = `Price not in buy zone (${priceAboveSupport.toFixed(2)}% from support, allowed: -${config.support_lower_bound_percent}% to +${config.support_upper_bound_percent}%)`;
        console.log(`❌ ${symbol}: ${rejectionReason}`);
        await this.logger.logSignalRejected(symbol, rejectionReason, {
          currentPrice,
          supportPrice: supportLevel.price,
          distancePercent: priceAboveSupport,
          allowedRange: {
            lower: -config.support_lower_bound_percent,
            upper: config.support_upper_bound_percent
          }
        });
        return { signalGenerated: false, reason: rejectionReason };
      }

      // Step 7: Calculate entry price
      console.log(`🎯 Step 7: Calculating entry price for ${symbol}...`);
      const entryPrice = supportLevel.price * (1 + config.entry_offset_percent / 100);
      console.log(`🎯 ${symbol}: Entry price calculation:
        - Support Price: $${supportLevel.price.toFixed(6)}
        - Entry Offset: ${config.entry_offset_percent}%
        - Calculated Entry: $${entryPrice.toFixed(6)}`);
      
      // Step 8: Validate entry price makes sense
      console.log(`🔧 Step 8: Validating entry price reasonableness for ${symbol}...`);
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

      // Step 9: Validate trade parameters
      console.log(`🔧 Step 9: Validating trade parameters for ${symbol}...`);
      const testQuantity = TradeValidator.calculateQuantity(symbol, config.max_order_amount_usd, entryPrice, config);
      const orderValue = testQuantity * entryPrice;
      
      console.log(`🔧 ${symbol}: Trade parameter validation:
        - Max Order Amount: $${config.max_order_amount_usd}
        - Entry Price: $${entryPrice.toFixed(6)}
        - Calculated Quantity: ${testQuantity}
        - Order Value: $${orderValue.toFixed(2)}`);
      
      if (!TradeValidator.validateTradeParameters(symbol, testQuantity, entryPrice, config)) {
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

      // Step 10: Create buy signal
      console.log(`✅ Step 10: All validations passed, creating buy signal for ${symbol}...`);
      const signalResult = await this.createBuySignal(symbol, entryPrice, supportLevel, config);
      
      if (signalResult) {
        console.log(`🎉 ${symbol}: Buy signal created successfully!`);
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

  private async createBuySignal(symbol: string, entryPrice: number, supportLevel: any, config: TradingConfigData): Promise<boolean> {
    try {
      console.log(`📝 Creating buy signal for ${symbol}...`);
      
      const confidence = Math.min(0.95, supportLevel.strength);
      const reasoning = `Buy signal: Price near support level at $${supportLevel.price.toFixed(6)} with ${supportLevel.strength.toFixed(3)} strength. Entry offset: ${config.entry_offset_percent}%`;

      console.log(`📝 ${symbol}: Signal details:
        - Entry Price: $${entryPrice.toFixed(6)}
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

      console.log(`✅ Buy signal created successfully for ${symbol}:
        - Signal ID: ${signal.id}
        - Entry Price: $${entryPrice.toFixed(6)}
        - Confidence: ${confidence.toFixed(3)}
        - Support Level: $${supportLevel.price.toFixed(6)}`);
      
      await this.logger.logSignalProcessed(symbol, 'buy', {
        signalId: signal.id,
        entryPrice,
        supportLevel: supportLevel.price,
        confidence: confidence,
        reasoning: reasoning,
        createdAt: signal.created_at
      });

      return true;

    } catch (error) {
      console.error(`❌ Error creating buy signal for ${symbol}:`, error);
      await this.logger.logError(`Failed to create buy signal for ${symbol}`, error, { symbol });
      return false;
    }
  }
}
