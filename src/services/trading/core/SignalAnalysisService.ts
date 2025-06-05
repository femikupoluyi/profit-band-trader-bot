
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
        
        // Generate signal if conditions are met
        const signal = await this.signalGenerator.generateSignal(symbol, currentPrice, supportLevel);
        if (signal) {
          console.log(`  🎯 Signal generated for ${symbol}: ${signal.action} at $${signal.price.toFixed(4)}`);
          await this.logger.logSuccess(`Signal generated for ${symbol}`, {
            symbol,
            action: signal.action,
            price: signal.price,
            supportLevel: supportLevel.price
          });
        } else {
          console.log(`  📭 No signal generated for ${symbol}`);
        }
      } else {
        console.log(`  📭 No valid support level found for ${symbol}`);
      }

    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
      await this.logger.logError(`Failed to analyze ${symbol}`, error, { symbol });
    }
  }
}
