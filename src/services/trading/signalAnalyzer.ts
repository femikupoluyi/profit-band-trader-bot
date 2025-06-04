
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { CandleDataService } from './candleDataService';
import { SupportLevelAnalyzer } from './supportLevelAnalyzer';
import { SignalGenerator } from './signalGenerator';
import { PositionChecker } from './positionChecker';

export class SignalAnalyzer {
  private userId: string;
  private config: TradingConfigData;
  private candleDataService: CandleDataService;
  private supportLevelAnalyzer: SupportLevelAnalyzer;
  private signalGenerator: SignalGenerator;
  private positionChecker: PositionChecker;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
    this.candleDataService = new CandleDataService();
    this.supportLevelAnalyzer = new SupportLevelAnalyzer();
    this.signalGenerator = new SignalGenerator(userId, config);
    this.positionChecker = new PositionChecker(userId);
  }

  async analyzeAndCreateSignals(): Promise<void> {
    // Use trading pairs from config - ensure all 10 pairs are analyzed
    const symbols = this.config.trading_pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'LTCUSDT', 'DOGEUSDT', 'MATICUSDT', 'FETUSDT'];
    
    console.log('\n🔍 STARTING COMPREHENSIVE SIGNAL ANALYSIS...');
    console.log('All trading pairs to analyze:', symbols);
    console.log('Config values:', {
      entryOffset: this.config.entry_offset_percent,
      takeProfitPercent: this.config.take_profit_percent,
      maxActivePairs: this.config.max_active_pairs,
      maxPositionsPerPair: this.config.max_positions_per_pair,
      supportAnalysisCandles: this.config.support_analysis_candles
    });
    
    let signalsGenerated = 0;
    let pairsAnalyzed = 0;
    
    for (const symbol of symbols) {
      try {
        pairsAnalyzed++;
        console.log(`\n📈 ANALYZING ${symbol} (${pairsAnalyzed}/${symbols.length})...`);
        
        // Always analyze all pairs - don't skip based on existing positions
        // This ensures all 10 trading pairs can potentially have limit orders
        const hasOpenPosition = await this.positionChecker.hasOpenPosition(symbol);
        
        if (hasOpenPosition) {
          console.log(`⚠️  ${symbol} has open position, but continuing analysis for potential additional entries based on support levels`);
        } else {
          console.log(`✅ ${symbol} has no open position, proceeding with fresh analysis`);
        }

        // Get current price from latest market data
        const { data: latestPrice, error: priceError } = await supabase
          .from('market_data')
          .select('price')
          .eq('symbol', symbol)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (priceError || !latestPrice) {
          console.log(`❌ No current price data for ${symbol}`);
          continue;
        }

        const currentPrice = parseFloat(latestPrice.price.toString());
        console.log(`💰 Current price for ${symbol}: $${currentPrice.toFixed(4)}`);

        // Use support analysis based on historical candles from config
        const supportAnalysisCandles = this.config.support_analysis_candles || 20;
        console.log(`📊 Analyzing ${supportAnalysisCandles} candles for support level detection`);

        // Get historical data for proper support analysis
        const candleData = await this.candleDataService.getCandleData(symbol, supportAnalysisCandles);
        
        let supportLevel;
        if (candleData && candleData.length >= 5) {
          // Use proper support level analysis with historical data
          const supportLevels = await this.supportLevelAnalyzer.findSupportLevels(candleData, currentPrice);
          supportLevel = supportLevels.length > 0 ? supportLevels[0] : null;
          console.log(`🎯 Historical support analysis found ${supportLevels.length} support levels`);
        } else {
          console.log(`⚠️  Limited historical data for ${symbol}, using simplified support calculation`);
          // Fallback to simplified support calculation
          const supportLevelPrice = currentPrice * 0.995; // Support 0.5% below current price
          supportLevel = {
            price: supportLevelPrice,
            strength: 0.8,
            touchCount: 3
          };
        }

        if (supportLevel) {
          console.log(`🎯 Using support level: $${supportLevel.price.toFixed(4)} (strength: ${supportLevel.strength})`);
          
          // Generate signal based on support level analysis
          const signal = await this.signalGenerator.generateSignal(symbol, currentPrice, supportLevel);
          
          if (signal) {
            signalsGenerated++;
            console.log(`🚀 SIGNAL GENERATED for ${symbol}! (Total signals: ${signalsGenerated})`);
            console.log(`  Entry strategy: Support-based limit order with take profit`);
            console.log(`  Support price: $${supportLevel.price.toFixed(4)}`);
            console.log(`  Current price: $${currentPrice.toFixed(4)}`);
          } else {
            console.log(`📭 No signal generated for ${symbol} at current market conditions`);
          }
        } else {
          console.log(`❌ No valid support level found for ${symbol}`);
        }
        
      } catch (error) {
        console.error(`❌ Error analyzing ${symbol}:`, error);
        await this.logActivity('analysis_error', `Analysis failed for ${symbol}`, { 
          error: error instanceof Error ? error.message : 'Unknown error',
          symbol 
        });
      }
    }
    
    console.log(`\n✅ COMPREHENSIVE SIGNAL ANALYSIS COMPLETED`);
    console.log(`📊 Summary: ${signalsGenerated} signals generated from ${pairsAnalyzed} pairs analyzed`);
    console.log(`🎯 Strategy: Support-based limit orders with take profit targeting all ${symbols.length} trading pairs\n`);
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
