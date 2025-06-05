
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SignalGenerator } from '../signalGenerator';
import { SupportLevelAnalyzer } from '../supportLevelAnalyzer';

export class SignalAnalysisService {
  private userId: string;
  private bybitService: BybitService;
  private signalGenerator: SignalGenerator;
  private supportLevelAnalyzer: SupportLevelAnalyzer;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.signalGenerator = new SignalGenerator(userId, {} as TradingConfigData); // Will be updated per call
    this.supportLevelAnalyzer = new SupportLevelAnalyzer();
  }

  async analyzeAndCreateSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('📈 Starting signal analysis...');
      
      // Update signal generator with current config
      this.signalGenerator = new SignalGenerator(this.userId, config);

      for (const symbol of config.trading_pairs) {
        await this.analyzeSymbol(symbol, config);
      }

      console.log('✅ Signal analysis completed');
    } catch (error) {
      console.error('❌ Error in signal analysis:', error);
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
        return;
      }

      if (!recentData || recentData.length < 10) {
        console.log(`  ⚠️ Insufficient market data for ${symbol} (${recentData?.length || 0} records)`);
        return;
      }

      // Analyze support levels
      const priceHistory = recentData.map(d => parseFloat(d.price.toString()));
      const supportLevel = this.supportLevelAnalyzer.findStrongestSupportLevel(
        priceHistory,
        currentPrice,
        config.support_lower_bound_percent || 5.0,
        config.support_upper_bound_percent || 2.0
      );

      if (supportLevel) {
        console.log(`  📊 Support found at $${supportLevel.price.toFixed(4)} (strength: ${supportLevel.strength})`);
        
        // Generate signal if conditions are met
        const signal = await this.signalGenerator.generateSignal(symbol, currentPrice, supportLevel);
        if (signal) {
          console.log(`  🎯 Signal generated for ${symbol}: ${signal.action} at $${signal.price.toFixed(4)}`);
        } else {
          console.log(`  📭 No signal generated for ${symbol}`);
        }
      } else {
        console.log(`  📭 No valid support level found for ${symbol}`);
      }

    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
      await this.logActivity('system_error', `Failed to analyze ${symbol}`, {
        symbol,
        error: error.message
      });
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: type,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
