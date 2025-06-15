
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../bybitService';
import { TradingLogger } from './core/TradingLogger';
import { TradingLogicFactory } from './core/TradingLogicFactory';
import { SignalGenerator } from './signalGenerator';
import { SupportLevel } from './core/TypeDefinitions';

export class SignalAnalyzer {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private signalGenerator: SignalGenerator;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.signalGenerator = new SignalGenerator(userId, {} as TradingConfigData); // Will be updated per call
  }

  async analyzeAndCreateSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('🔍 Starting signal analysis for all symbols with precision formatting...');
      await this.logger.logSystemInfo('Starting signal analysis', { symbolCount: config.trading_pairs.length });

      // Update signal generator with current config
      this.signalGenerator = new SignalGenerator(this.userId, config);

      for (const symbol of config.trading_pairs) {
        await this.analyzeSymbol(symbol, config);
      }

      console.log('✅ Signal analysis completed for all symbols');
      await this.logger.logSuccess('Signal analysis completed with precision formatting');
    } catch (error) {
      console.error('❌ Error in signal analysis:', error);
      await this.logger.logError('Signal analysis failed', error);
      throw error;
    }
  }

  // Keep backward compatibility
  async analyzeSymbolsAndGenerateSignals(config: TradingConfigData): Promise<void> {
    return this.analyzeAndCreateSignals(config);
  }

  private async analyzeSymbol(symbol: string, config: TradingConfigData): Promise<void> {
    try {
      console.log(`\n🔍 Analyzing ${symbol} with ${config.trading_logic_type}...`);

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

      // Get the appropriate trading logic
      const tradingLogic = TradingLogicFactory.getLogic(config.trading_logic_type);
      console.log(`🔧 Using ${tradingLogic.name} for ${symbol}`);

      let supportLevel: SupportLevel;

      if (recentData && recentData.length >= 10) {
        const candleData = recentData.map(d => ({
          low: parseFloat(d.price.toString()),
          high: parseFloat(d.price.toString()),
          open: parseFloat(d.price.toString()),
          close: parseFloat(d.price.toString()),
          volume: parseFloat(d.volume?.toString() || '0'),
          timestamp: new Date(d.timestamp).getTime()
        }));

        // Use the trading logic with precision formatting
        const supportLevels = await tradingLogic.analyzeSupportLevels(candleData, config, symbol);
        
        if (supportLevels && supportLevels.length > 0) {
          supportLevel = supportLevels[0]; // Use the strongest support level
          console.log(`📊 ${tradingLogic.name} found formatted support at $${supportLevel.price.toFixed(4)} (strength: ${supportLevel.strength})`);
        } else {
          // Fallback: create a basic support level with proper formatting
          const { SupportLevelProcessor } = await import('./core/SupportLevelProcessor');
          const fallbackPrice = await SupportLevelProcessor.formatSupportLevel(symbol, currentPrice * 0.995);
          
          supportLevel = {
            price: fallbackPrice,
            strength: 0.6,
            timestamp: Date.now(),
            touches: 2
          };
          console.log(`📊 Using formatted fallback support at $${supportLevel.price.toFixed(4)}`);
        }
      } else {
        // Fallback: support 0.5% below current price with proper formatting
        const { SupportLevelProcessor } = await import('./core/SupportLevelProcessor');
        const fallbackPrice = await SupportLevelProcessor.formatSupportLevel(symbol, currentPrice * 0.995);
        
        supportLevel = {
          price: fallbackPrice,
          strength: 0.8,
          timestamp: Date.now(),
          touches: 3
        };
        console.log(`📊 Using formatted fallback support at $${supportLevel.price.toFixed(4)} (insufficient data)`);
      }

      // Generate signal if conditions are met
      const signal = await this.signalGenerator.generateSignal(symbol, currentPrice, supportLevel);
      if (signal) {
        console.log(`🎯 Precision-formatted signal generated for ${symbol}: ${signal.action} at $${signal.price.toFixed(4)}`);
        await this.logger.logSuccess(`Precision-formatted signal generated for ${symbol}`, {
          symbol,
          action: signal.action,
          price: signal.price,
          supportLevel: supportLevel.price,
          tradingLogic: tradingLogic.name
        });
      } else {
        console.log(`📭 No signal generated for ${symbol} using ${tradingLogic.name}`);
      }

    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
      await this.logger.logError(`Failed to analyze ${symbol}`, error, { symbol });
    }
  }
}
