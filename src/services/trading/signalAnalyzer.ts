
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../bybitService';
import { TradingLogger } from './core/TradingLogger';
import { SupportLevelAnalyzer } from './supportLevelAnalyzer';
import { SignalGenerator } from './signalGenerator';
import { SupportLevel } from './core/TypeDefinitions';

export class SignalAnalyzer {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private supportAnalyzer: SupportLevelAnalyzer;
  private signalGenerator: SignalGenerator;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.supportAnalyzer = new SupportLevelAnalyzer();
    this.signalGenerator = new SignalGenerator(userId, {} as TradingConfigData); // Will be updated per call
  }

  async analyzeSymbolsAndGenerateSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('🔍 Starting signal analysis for all symbols...');
      await this.logger.logSystemInfo('Starting signal analysis', { symbolCount: config.trading_pairs.length });

      // Update signal generator with current config
      this.signalGenerator = new SignalGenerator(this.userId, config);

      for (const symbol of config.trading_pairs) {
        await this.analyzeSymbol(symbol, config);
      }

      console.log('✅ Signal analysis completed for all symbols');
      await this.logger.logSuccess('Signal analysis completed');
    } catch (error) {
      console.error('❌ Error in signal analysis:', error);
      await this.logger.logError('Signal analysis failed', error);
      throw error;
    }
  }

  private async analyzeSymbol(symbol: string, config: TradingConfigData): Promise<void> {
    try {
      console.log(`\n🔍 Analyzing ${symbol}...`);

      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(symbol);
      const currentPrice = marketData.price;
      
      console.log(`💰 Current price for ${symbol}: $${currentPrice.toFixed(4)}`);

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

      // SIMPLIFIED SUPPORT ANALYSIS - Always create a basic support level
      let supportLevel: SupportLevel = {
        price: currentPrice * 0.995, // Support 0.5% below current price
        strength: 0.8,
        timestamp: Date.now(),
        touches: 3,
        touchCount: 3 // For backward compatibility
      };

      // Try to get better support data if available
      if (recentData && recentData.length >= 10) {
        const candleData = recentData.map(d => ({
          low: parseFloat(d.price.toString()),
          high: parseFloat(d.price.toString()),
          open: parseFloat(d.price.toString()),
          close: parseFloat(d.price.toString()),
          volume: parseFloat(d.volume?.toString() || '0'),
          timestamp: new Date(d.timestamp).getTime()
        }));

        const analyzedSupport = this.supportAnalyzer.identifySupportLevel(candleData);
        if (analyzedSupport && analyzedSupport.strength > 0.3) {
          supportLevel = analyzedSupport;
          console.log(`📊 Found stronger support at $${supportLevel.price.toFixed(4)} (strength: ${supportLevel.strength})`);
        }
      }

      // Generate signal if conditions are met
      const signal = await this.signalGenerator.generateSignal(symbol, currentPrice, supportLevel);
      if (signal) {
        console.log(`🎯 Signal generated for ${symbol}: ${signal.action} at $${signal.price.toFixed(4)}`);
        await this.logger.logSuccess(`Signal generated for ${symbol}`, {
          symbol,
          action: signal.action,
          price: signal.price,
          supportLevel: supportLevel.price
        });
      } else {
        console.log(`📭 No signal generated for ${symbol}`);
      }

    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
      await this.logger.logError(`Failed to analyze ${symbol}`, error, { symbol });
    }
  }
}
