
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
      await this.logger.logSuccess('Starting comprehensive signal analysis', {
        tradingPairsCount: config.trading_pairs.length,
        tradingPairs: config.trading_pairs,
        maxOrderAmount: config.max_order_amount_usd,
        takeProfitPercent: config.take_profit_percent
      });

      let analysisResults = {
        totalPairs: config.trading_pairs.length,
        analyzedPairs: 0,
        signalsGenerated: 0,
        signalsRejected: 0,
        errors: 0
      };

      for (const symbol of config.trading_pairs) {
        try {
          analysisResults.analyzedPairs++;
          const result = await this.analyzeSymbol(symbol, config);
          if (result.signalGenerated) {
            analysisResults.signalsGenerated++;
          } else {
            analysisResults.signalsRejected++;
          }
        } catch (error) {
          analysisResults.errors++;
          console.error(`❌ Error analyzing ${symbol}:`, error);
          await this.logger.logError(`Failed to analyze ${symbol}`, error, { symbol });
        }
      }

      console.log('📊 ===== SIGNAL ANALYSIS SUMMARY =====', analysisResults);
      await this.logger.logSuccess('Signal analysis completed', analysisResults);
    } catch (error) {
      console.error('❌ Error in signal analysis:', error);
      await this.logger.logError('Error in signal analysis', error);
      throw error;
    }
  }

  private async analyzeSymbol(symbol: string, config: TradingConfigData): Promise<{ signalGenerated: boolean; reason?: string }> {
    try {
      console.log(`\n🔍 ===== ANALYZING ${symbol} =====`);
      await this.logger.logSystemInfo(`Starting analysis for ${symbol}`);

      // Step 1: Check existing signals
      const { data: existingSignals, error: signalsError } = await supabase
        .from('trading_signals')
        .select('id')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('processed', false);

      if (signalsError) {
        console.error(`❌ Error checking existing signals for ${symbol}:`, signalsError);
        await this.logger.logError(`Error checking existing signals for ${symbol}`, signalsError, { symbol });
        return { signalGenerated: false, reason: 'Database error checking existing signals' };
      }

      if (existingSignals && existingSignals.length >= config.max_positions_per_pair) {
        console.log(`⚠️ ${symbol}: Already has ${existingSignals.length} unprocessed signals (max: ${config.max_positions_per_pair})`);
        await this.logger.logSignalRejected(symbol, 'Max unprocessed signals reached', {
          existingSignals: existingSignals.length,
          maxAllowed: config.max_positions_per_pair
        });
        return { signalGenerated: false, reason: 'Max unprocessed signals reached' };
      }

      // Step 2: Get current market price
      console.log(`📊 Getting market price for ${symbol}...`);
      const marketData = await this.bybitService.getMarketPrice(symbol);
      const currentPrice = marketData.price;
      
      console.log(`💰 Current price for ${symbol}: $${currentPrice.toFixed(6)}`);
      await this.logger.logMarketDataUpdate(symbol, currentPrice, 'bybit');

      // Step 3: Get recent market data for support analysis
      console.log(`📈 Fetching historical market data for ${symbol}...`);
      const { data: recentData, error } = await supabase
        .from('market_data')
        .select('*')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(config.support_candle_count || 128);

      if (error) {
        console.error(`❌ Error fetching market data for ${symbol}:`, error);
        await this.logger.logError(`Error fetching market data for ${symbol}`, error, { symbol });
        return { signalGenerated: false, reason: 'Error fetching market data' };
      }

      if (!recentData || recentData.length < 10) {
        console.log(`⚠️ ${symbol}: Insufficient market data (${recentData?.length || 0} records, need at least 10)`);
        await this.logger.logSignalRejected(symbol, 'Insufficient market data', {
          dataRecords: recentData?.length || 0,
          minimumRequired: 10
        });
        return { signalGenerated: false, reason: 'Insufficient market data' };
      }

      console.log(`📊 ${symbol}: Found ${recentData.length} market data records`);

      // Step 4: Analyze support levels
      console.log(`🔍 Analyzing support levels for ${symbol}...`);
      const priceHistory = recentData.map(d => parseFloat(d.price.toString()));
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
        console.log(`❌ ${symbol}: No valid support level found (strength: ${supportLevel?.strength || 'N/A'})`);
        await this.logger.logSignalRejected(symbol, 'No valid support level', {
          supportLevel: supportLevel?.price || null,
          strength: supportLevel?.strength || 0,
          minimumStrength: 0.3
        });
        return { signalGenerated: false, reason: 'No valid support level' };
      }

      console.log(`📊 ${symbol}: Support found at $${supportLevel.price.toFixed(6)} (strength: ${supportLevel.strength.toFixed(3)})`);
      
      // Step 5: Check if price is in buy zone
      const priceAboveSupport = ((currentPrice - supportLevel.price) / supportLevel.price) * 100;
      
      console.log(`📐 ${symbol}: Price analysis:
        - Current: $${currentPrice.toFixed(6)}
        - Support: $${supportLevel.price.toFixed(6)}
        - Distance: ${priceAboveSupport.toFixed(2)}%
        - Bounds: -${config.support_lower_bound_percent}% to +${config.support_upper_bound_percent}%`);

      if (priceAboveSupport < -config.support_lower_bound_percent || priceAboveSupport > config.support_upper_bound_percent) {
        console.log(`❌ ${symbol}: Price not in buy zone (${priceAboveSupport.toFixed(2)}% from support)`);
        await this.logger.logSignalRejected(symbol, 'Price not in buy zone', {
          currentPrice,
          supportPrice: supportLevel.price,
          distancePercent: priceAboveSupport,
          lowerBound: -config.support_lower_bound_percent,
          upperBound: config.support_upper_bound_percent
        });
        return { signalGenerated: false, reason: 'Price not in buy zone' };
      }

      // Step 6: Calculate entry price
      const entryPrice = supportLevel.price * (1 + config.entry_offset_percent / 100);
      console.log(`🎯 ${symbol}: Calculated entry price: $${entryPrice.toFixed(6)} (+${config.entry_offset_percent}% offset)`);
      
      // Step 7: Validate entry price makes sense
      const entryPriceDistance = Math.abs((entryPrice - currentPrice) / currentPrice) * 100;
      if (entryPriceDistance > 5) {
        console.log(`❌ ${symbol}: Entry price too far from current price (${entryPriceDistance.toFixed(2)}% away)`);
        await this.logger.logSignalRejected(symbol, 'Entry price too far from current price', {
          entryPrice,
          currentPrice,
          distancePercent: entryPriceDistance
        });
        return { signalGenerated: false, reason: 'Entry price too far from current price' };
      }

      // Step 8: Validate trade parameters
      console.log(`🔧 ${symbol}: Validating trade parameters...`);
      const testQuantity = TradeValidator.calculateQuantity(symbol, config.max_order_amount_usd, entryPrice, config);
      
      if (!TradeValidator.validateTradeParameters(symbol, testQuantity, entryPrice, config)) {
        console.log(`❌ ${symbol}: Trade parameter validation failed`);
        await this.logger.logSignalRejected(symbol, 'Trade parameter validation failed', {
          entryPrice,
          testQuantity,
          maxOrderAmount: config.max_order_amount_usd
        });
        return { signalGenerated: false, reason: 'Trade parameter validation failed' };
      }

      // Step 9: Create buy signal
      console.log(`✅ ${symbol}: All checks passed, creating buy signal...`);
      const signalResult = await this.createBuySignal(symbol, entryPrice, supportLevel, config);
      
      return { signalGenerated: signalResult, reason: signalResult ? 'Signal created successfully' : 'Failed to create signal' };

    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
      await this.logger.logError(`Failed to analyze ${symbol}`, error, { symbol });
      return { signalGenerated: false, reason: 'Analysis error' };
    }
  }

  private async createBuySignal(symbol: string, entryPrice: number, supportLevel: any, config: TradingConfigData): Promise<boolean> {
    try {
      console.log(`📝 Creating buy signal for ${symbol}...`);
      
      const confidence = Math.min(0.95, supportLevel.strength);
      const reasoning = `Buy signal: Price near support level at $${supportLevel.price.toFixed(6)} with ${supportLevel.strength.toFixed(3)} strength. Entry offset: ${config.entry_offset_percent}%`;

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
        console.error(`❌ Error creating signal for ${symbol}:`, error);
        await this.logger.logError(`Error creating signal for ${symbol}`, error, { symbol });
        return false;
      }

      console.log(`✅ Buy signal created for ${symbol}:
        - Signal ID: ${signal.id}
        - Entry Price: $${entryPrice.toFixed(6)}
        - Confidence: ${confidence.toFixed(3)}
        - Support Level: $${supportLevel.price.toFixed(6)}`);
      
      await this.logger.logSignalProcessed(symbol, 'buy', {
        signalId: signal.id,
        entryPrice,
        supportLevel: supportLevel.price,
        confidence: confidence,
        reasoning: reasoning
      });

      return true;

    } catch (error) {
      console.error(`❌ Error creating buy signal for ${symbol}:`, error);
      await this.logger.logError(`Failed to create buy signal for ${symbol}`, error, { symbol });
      return false;
    }
  }
}
