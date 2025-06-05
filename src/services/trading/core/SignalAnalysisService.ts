
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
      console.log('📈 Starting signal analysis...');
      await this.logger.logSuccess('Starting signal analysis');

      for (const symbol of config.trading_pairs) {
        await this.analyzeSymbol(symbol, config);
      }

      console.log('✅ Signal analysis completed');
      await this.logger.logSuccess('Signal analysis completed');
    } catch (error) {
      console.error('❌ Error in signal analysis:', error);
      await this.logger.logError('Error in signal analysis', error);
      throw error;
    }
  }

  private async analyzeSymbol(symbol: string, config: TradingConfigData): Promise<void> {
    try {
      console.log(`\n🔍 Analyzing ${symbol}...`);

      // Check if we already have enough active signals for this symbol
      const { data: existingSignals, error: signalsError } = await supabase
        .from('trading_signals')
        .select('id')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('processed', false);

      if (signalsError) {
        console.error(`❌ Error checking existing signals for ${symbol}:`, signalsError);
        return;
      }

      if (existingSignals && existingSignals.length >= config.max_positions_per_pair) {
        console.log(`  ⚠️ Already have ${existingSignals.length} unprocessed signals for ${symbol}, skipping`);
        return;
      }

      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(symbol);
      const currentPrice = marketData.price;
      
      console.log(`  Current Price: $${currentPrice.toFixed(4)}`);

      // Get recent market data for support analysis
      const { data: recentData, error } = await supabase
        .from('market_data')
        .select('*')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(config.support_candle_count || 128);

      if (error) {
        console.error(`❌ Error fetching market data for ${symbol}:`, error);
        await this.logger.logError(`Error fetching market data for ${symbol}`, error, { symbol });
        return;
      }

      if (!recentData || recentData.length < 10) {
        console.log(`  ⚠️ Insufficient market data for ${symbol} (${recentData?.length || 0} records)`);
        return;
      }

      // Analyze support levels
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

      if (supportLevel && supportLevel.strength > 0.3) {
        console.log(`  📊 Support found at $${supportLevel.price.toFixed(4)} (strength: ${supportLevel.strength})`);
        
        // Check if current price is near support level for potential buy signal
        const priceAboveSupport = ((currentPrice - supportLevel.price) / supportLevel.price) * 100;
        
        // Validate price is within acceptable bounds
        if (priceAboveSupport >= 0 && 
            priceAboveSupport <= config.support_upper_bound_percent &&
            priceAboveSupport >= -config.support_lower_bound_percent) {
          
          // Calculate entry price with offset
          const entryPrice = supportLevel.price * (1 + config.entry_offset_percent / 100);
          
          // Additional validation: ensure entry price makes sense
          if (entryPrice > currentPrice * 0.95 && entryPrice < currentPrice * 1.05) {
            console.log(`  🎯 Buy signal conditions met for ${symbol}`);
            await this.createBuySignal(symbol, entryPrice, supportLevel, config);
          } else {
            console.log(`  📭 Entry price ${entryPrice.toFixed(4)} too far from current price for ${symbol}`);
          }
        } else {
          console.log(`  📭 Price not in buy zone for ${symbol} (${priceAboveSupport.toFixed(2)}% from support, bounds: -${config.support_lower_bound_percent}% to +${config.support_upper_bound_percent}%)`);
        }
      } else {
        console.log(`  📭 No valid support level found for ${symbol} (strength: ${supportLevel?.strength || 'N/A'})`);
      }

    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
      await this.logger.logError(`Failed to analyze ${symbol}`, error, { symbol });
    }
  }

  private async createBuySignal(symbol: string, entryPrice: number, supportLevel: any, config: TradingConfigData): Promise<void> {
    try {
      // Validate signal parameters before creating
      const testQuantity = TradeValidator.calculateQuantity(symbol, config.max_order_amount_usd, entryPrice, config);
      
      if (!TradeValidator.validateTradeParameters(symbol, testQuantity, entryPrice, config)) {
        console.log(`  ❌ Signal validation failed for ${symbol}`);
        await this.logger.logError(`Signal validation failed for ${symbol}`, new Error('Trade parameters invalid'), { symbol, entryPrice, testQuantity });
        return;
      }

      const { data: signal, error } = await supabase
        .from('trading_signals')
        .insert({
          user_id: this.userId,
          symbol: symbol,
          signal_type: 'buy',
          price: entryPrice,
          confidence: Math.min(0.95, supportLevel.strength), // Cap confidence at 95%
          reasoning: `Buy signal: Price near support level at $${supportLevel.price.toFixed(4)} with ${supportLevel.strength.toFixed(2)} strength. Entry offset: ${config.entry_offset_percent}%`,
          processed: false
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Error creating signal for ${symbol}:`, error);
        await this.logger.logError(`Error creating signal for ${symbol}`, error, { symbol });
        return;
      }

      console.log(`✅ Buy signal created for ${symbol} at $${entryPrice.toFixed(4)} (ID: ${signal.id})`);
      await this.logger.logSignalProcessed(symbol, 'buy', {
        signalId: signal.id,
        entryPrice,
        supportLevel: supportLevel.price,
        confidence: supportLevel.strength,
        reasoning: signal.reasoning
      });

    } catch (error) {
      console.error(`❌ Error creating buy signal for ${symbol}:`, error);
      await this.logger.logError(`Failed to create buy signal for ${symbol}`, error, { symbol });
    }
  }
}
