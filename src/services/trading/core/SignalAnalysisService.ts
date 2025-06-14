
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

      // Step 1: Check existing signals and positions
      console.log(`📋 Step 1: Checking existing positions and signals for ${symbol}...`);
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

      const { data: activeTrades, error: tradesError } = await supabase
        .from('trades')
        .select('id, status, side, price, quantity, created_at')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('side', 'buy')
        .in('status', ['pending', 'filled', 'partial_filled']);

      if (tradesError) {
        console.error(`❌ Database error checking active trades for ${symbol}:`, tradesError);
        return { signalGenerated: false, reason: 'Database error checking active trades' };
      }

      const totalActiveCount = (existingSignals?.length || 0) + (activeTrades?.length || 0);
      console.log(`📊 ${symbol}: Found ${existingSignals?.length || 0} unprocessed signals + ${activeTrades?.length || 0} active trades = ${totalActiveCount} total (max allowed: ${config.max_positions_per_pair})`);
      
      if (totalActiveCount >= config.max_positions_per_pair) {
        const rejectionReason = `Max positions reached (${totalActiveCount}/${config.max_positions_per_pair})`;
        console.log(`⚠️ ${symbol}: ${rejectionReason}`);
        return { signalGenerated: false, reason: rejectionReason };
      }

      // Step 2: Get current market price
      console.log(`📊 Step 2: Getting current market price for ${symbol}...`);
      const marketData = await this.bybitService.getMarketPrice(symbol);
      const currentPrice = marketData.price;
      
      console.log(`💰 ${symbol}: Current market price: $${currentPrice.toFixed(6)}`);

      // Step 3: Determine if this is a new position or averaging down
      const isAveragingDown = activeTrades && activeTrades.length > 0;
      console.log(`🔄 ${symbol}: ${isAveragingDown ? 'AVERAGING DOWN scenario' : 'NEW POSITION scenario'}`);

      if (isAveragingDown) {
        // Averaging down logic
        const lastBoughtPrice = Math.max(...activeTrades.map(t => parseFloat(t.price.toString())));
        console.log(`📊 ${symbol}: Last bought price: $${lastBoughtPrice.toFixed(6)}`);
        
        // Check if current price is within averaging bounds relative to last bought price
        const priceChangePercent = ((currentPrice - lastBoughtPrice) / lastBoughtPrice) * 100;
        const lowerBound = -config.support_lower_bound_percent; // Negative because price should be lower
        const upperBound = config.support_upper_bound_percent;
        
        console.log(`📐 ${symbol}: Averaging down analysis:
          - Current Price: $${currentPrice.toFixed(6)}
          - Last Bought Price: $${lastBoughtPrice.toFixed(6)}
          - Price Change: ${priceChangePercent.toFixed(2)}%
          - Allowed Range: ${lowerBound.toFixed(2)}% to +${upperBound.toFixed(2)}%
          - In Range: ${priceChangePercent >= lowerBound && priceChangePercent <= upperBound ? 'YES' : 'NO'}`);

        if (priceChangePercent < lowerBound || priceChangePercent > upperBound) {
          const rejectionReason = `Price not in averaging range (${priceChangePercent.toFixed(2)}% change, allowed: ${lowerBound.toFixed(2)}% to +${upperBound.toFixed(2)}%)`;
          console.log(`❌ ${symbol}: ${rejectionReason}`);
          return { signalGenerated: false, reason: rejectionReason };
        }

        // Place limit order below current market price for averaging down
        const entryPrice = currentPrice * (1 - config.entry_offset_percent / 100);
        console.log(`🎯 ${symbol}: Averaging down entry price: $${entryPrice.toFixed(6)} (${config.entry_offset_percent}% below current price)`);
        
        return await this.createLimitBuySignal(symbol, entryPrice, { price: currentPrice, strength: 0.8, touches: 1 }, config, true);

      } else {
        // New position logic - analyze support levels
        console.log(`📈 Step 3: Fetching historical market data for ${symbol}...`);
        const { data: recentData, error } = await supabase
          .from('market_data')
          .select('*')
          .eq('symbol', symbol)
          .order('timestamp', { ascending: false })
          .limit(config.support_candle_count || 128);

        if (error) {
          console.error(`❌ Database error fetching market data for ${symbol}:`, error);
          return { signalGenerated: false, reason: 'Error fetching market data' };
        }

        if (!recentData || recentData.length < 10) {
          const rejectionReason = `Insufficient market data (${recentData?.length || 0} records, need at least 10)`;
          console.log(`⚠️ ${symbol}: ${rejectionReason}`);
          return { signalGenerated: false, reason: rejectionReason };
        }

        console.log(`📊 ${symbol}: Found ${recentData.length} market data records for analysis`);

        // Convert market data to candle format
        const candleData = recentData.map(d => ({
          open: parseFloat(d.price.toString()),
          high: parseFloat(d.price.toString()) * 1.001,
          low: parseFloat(d.price.toString()) * 0.999,
          close: parseFloat(d.price.toString()),
          volume: parseFloat(d.volume?.toString() || '0'),
          timestamp: new Date(d.timestamp).getTime()
        }));

        // Analyze support levels using selected logic
        console.log(`🧠 Step 4: Analyzing support levels using ${tradingLogic.name} for ${symbol}...`);
        const supportLevels = tradingLogic.analyzeSupportLevels(candleData, config);

        if (!supportLevels || supportLevels.length === 0) {
          const rejectionReason = `No support levels found using ${tradingLogic.name}`;
          console.log(`❌ ${symbol}: ${rejectionReason}`);
          return { signalGenerated: false, reason: rejectionReason };
        }

        const bestSupport = supportLevels[0];
        console.log(`📊 ${symbol}: Best support level: $${bestSupport.price.toFixed(6)} (strength: ${bestSupport.strength.toFixed(3)})`);

        // For new positions, place limit order above support level
        const entryPrice = bestSupport.price * (1 + config.entry_offset_percent / 100);
        console.log(`🎯 ${symbol}: New position entry price: $${entryPrice.toFixed(6)} (${config.entry_offset_percent}% above support)`);
        
        return await this.createLimitBuySignal(symbol, entryPrice, bestSupport, config, false);
      }

    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
      await this.logger.logError(`Failed to analyze ${symbol}`, error, { symbol });
      return { signalGenerated: false, reason: `Analysis error: ${error.message}` };
    }
  }

  private async createLimitBuySignal(symbol: string, entryPrice: number, supportLevel: any, config: TradingConfigData, isAveragingDown: boolean = false): Promise<{ signalGenerated: boolean; reason?: string }> {
    try {
      console.log(`📝 Creating LIMIT buy signal for ${symbol}...`);
      
      // Validate trade parameters
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
        return { signalGenerated: false, reason: rejectionReason };
      }

      const confidence = Math.min(0.95, supportLevel.strength || 0.8);
      const orderType = isAveragingDown ? 'AVERAGING DOWN' : 'NEW POSITION';
      const reasoning = `${orderType} LIMIT Buy: Entry at $${entryPrice.toFixed(6)} (${config.entry_offset_percent}% ${isAveragingDown ? 'below current price' : 'above support $' + supportLevel.price.toFixed(6)}). Take profit: ${config.take_profit_percent}%`;

      console.log(`📝 ${symbol}: LIMIT signal details:
        - Order Type: ${orderType} LIMIT
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
        return { signalGenerated: false, reason: 'Database error creating signal' };
      }

      console.log(`✅ LIMIT buy signal created successfully for ${symbol}:
        - Signal ID: ${signal.id}
        - Order Type: ${orderType} LIMIT
        - Entry Price: $${entryPrice.toFixed(6)}
        - Take Profit: ${config.take_profit_percent}%
        - Confidence: ${confidence.toFixed(3)}`);
      
      await this.logger.logSignalProcessed(symbol, 'buy', {
        signalId: signal.id,
        orderType: `${orderType} LIMIT`,
        entryPrice,
        takeProfitPercent: config.take_profit_percent,
        supportLevel: supportLevel.price,
        confidence: confidence,
        reasoning: reasoning,
        isAveragingDown,
        createdAt: signal.created_at
      });

      return { signalGenerated: true, reason: 'Signal created successfully' };

    } catch (error) {
      console.error(`❌ Error creating LIMIT buy signal for ${symbol}:`, error);
      await this.logger.logError(`Failed to create LIMIT buy signal for ${symbol}`, error, { symbol });
      return { signalGenerated: false, reason: `Signal creation error: ${error.message}` };
    }
  }
}
