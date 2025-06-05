
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SignalGenerator } from '../signalGenerator';
import { SupportLevelAnalyzer } from '../supportLevelAnalyzer';
import { TradingLogger } from './TradingLogger';

export class SignalAnalysisService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private signalGenerator: SignalGenerator;
  private supportLevelAnalyzer: SupportLevelAnalyzer;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.bybitService.setLogger(this.logger);
    this.signalGenerator = new SignalGenerator(userId, {} as TradingConfigData); // Will be updated per call
    this.supportLevelAnalyzer = new SupportLevelAnalyzer();
  }

  async analyzeAndCreateSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('📈 Starting signal analysis...');
      await this.logger.logSuccess('Starting signal analysis');
      
      // Update signal generator with current config
      this.signalGenerator = new SignalGenerator(this.userId, config);

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
        await this.logger.logSuccess(`Insufficient market data for ${symbol}`, {
          symbol,
          recordCount: recentData?.length || 0,
          required: 10
        });
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

      if (supportLevel) {
        console.log(`  📊 Support found at $${supportLevel.price.toFixed(4)} (strength: ${supportLevel.strength})`);
        
        // Check if current price is near support level for potential buy signal
        const priceAboveSupport = ((currentPrice - supportLevel.price) / supportLevel.price) * 100;
        
        if (priceAboveSupport > 0 && priceAboveSupport <= config.entry_offset_percent) {
          // Generate buy signal
          const entryPrice = supportLevel.price * (1 + config.entry_offset_percent / 100);
          
          console.log(`  🎯 Buy signal conditions met for ${symbol}`);
          await this.createBuySignal(symbol, entryPrice, supportLevel, config);
        } else {
          console.log(`  📭 Price not in buy zone for ${symbol} (${priceAboveSupport.toFixed(2)}% above support)`);
        }
      } else {
        console.log(`  📭 No valid support level found for ${symbol}`);
      }

    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
      await this.logger.logError(`Failed to analyze ${symbol}`, error, { symbol });
    }
  }

  private async createBuySignal(symbol: string, entryPrice: number, supportLevel: any, config: TradingConfigData): Promise<void> {
    try {
      const { data: signal, error } = await supabase
        .from('trading_signals')
        .insert({
          user_id: this.userId,
          symbol: symbol,
          signal_type: 'buy',
          price: entryPrice,
          confidence: supportLevel.strength,
          reasoning: `Buy signal: Price near support level at $${supportLevel.price.toFixed(4)} with ${supportLevel.strength} strength`,
          processed: false
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Error creating signal for ${symbol}:`, error);
        await this.logger.logError(`Error creating signal for ${symbol}`, error, { symbol });
        return;
      }

      console.log(`✅ Buy signal created for ${symbol} at $${entryPrice.toFixed(4)}`);
      await this.logger.logSignalProcessed(symbol, 'buy', {
        signalId: signal.id,
        entryPrice,
        supportLevel: supportLevel.price,
        confidence: supportLevel.strength
      });

    } catch (error) {
      console.error(`❌ Error creating buy signal for ${symbol}:`, error);
      await this.logger.logError(`Failed to create buy signal for ${symbol}`, error, { symbol });
    }
  }
}
