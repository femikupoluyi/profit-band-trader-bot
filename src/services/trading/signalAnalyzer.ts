
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
    
    console.log('\n🔍 STARTING AGGRESSIVE SIGNAL ANALYSIS...');
    console.log('All trading pairs to analyze:', symbols);
    console.log('Strategy: Generate signals for all pairs without active positions');
    
    let signalsGenerated = 0;
    let pairsAnalyzed = 0;
    
    for (const symbol of symbols) {
      try {
        pairsAnalyzed++;
        console.log(`\n📈 ANALYZING ${symbol} (${pairsAnalyzed}/${symbols.length})...`);
        
        // Check if pair has existing position
        const hasOpenPosition = await this.positionChecker.hasOpenPosition(symbol);
        
        if (hasOpenPosition) {
          console.log(`⚠️  ${symbol} has open position, skipping signal generation`);
          continue;
        }

        console.log(`✅ ${symbol} has no open position, proceeding with signal generation`);

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

        // SIMPLIFIED SUPPORT ANALYSIS - Always create a basic support level
        let supportLevel = {
          price: currentPrice * 0.995, // Support 0.5% below current price
          strength: 0.8,
          touchCount: 3
        };

        // Try to get better support data if available
        const supportCandleCount = this.config.support_candle_count || 20;
        console.log(`📊 Attempting to get ${supportCandleCount} candles for enhanced support analysis`);

        try {
          const candleData = await this.candleDataService.getCandleData(symbol, supportCandleCount);
          
          if (candleData && candleData.length >= 5) {
            const identifiedSupport = this.supportLevelAnalyzer.identifySupportLevel(candleData);
            if (identifiedSupport && identifiedSupport.price > 0) {
              supportLevel = identifiedSupport;
              console.log(`📈 Enhanced support level identified: $${supportLevel.price.toFixed(4)}`);
            }
          }
        } catch (candleError) {
          console.log(`⚠️  Using basic support calculation due to candle data error:`, candleError);
        }

        console.log(`🎯 Using support level: $${supportLevel.price.toFixed(4)} (strength: ${supportLevel.strength})`);
        
        // ALWAYS TRY TO GENERATE SIGNAL for pairs without positions
        console.log(`🔄 Attempting to generate signal for ${symbol}...`);
        const signal = await this.signalGenerator.generateSignal(symbol, currentPrice, supportLevel);
        
        if (signal) {
          signalsGenerated++;
          console.log(`🚀 SIGNAL GENERATED for ${symbol}! (Total signals: ${signalsGenerated})`);
          console.log(`  Entry strategy: Aggressive limit order below current price`);
          console.log(`  Entry price: $${signal.price.toFixed(4)}`);
          console.log(`  Current price: $${currentPrice.toFixed(4)}`);
        } else {
          console.log(`📭 No signal generated for ${symbol} - checking signal generation logic`);
        }
        
      } catch (error) {
        console.error(`❌ Error analyzing ${symbol}:`, error);
        await this.logActivity('analysis_error', `Analysis failed for ${symbol}`, { 
          error: error instanceof Error ? error.message : 'Unknown error',
          symbol 
        });
      }
    }
    
    console.log(`\n✅ AGGRESSIVE SIGNAL ANALYSIS COMPLETED`);
    console.log(`📊 Summary: ${signalsGenerated} signals generated from ${pairsAnalyzed} pairs analyzed`);
    console.log(`🎯 Strategy: Aggressive limit orders for all pairs without active positions\n`);
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
