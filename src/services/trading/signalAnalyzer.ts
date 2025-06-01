
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
    // Use trading pairs from config
    const symbols = this.config.trading_pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];
    
    console.log('\n🔍 STARTING SIGNAL ANALYSIS...');
    console.log('Trading pairs to analyze:', symbols);
    console.log('Config values:', {
      entryOffset: this.config.entry_offset_percent,
      takeProfitPercent: this.config.take_profit_percent,
      maxActivePairs: this.config.max_active_pairs,
      maxPositionsPerPair: this.config.max_positions_per_pair
    });
    
    for (const symbol of symbols) {
      try {
        console.log(`\n📈 ANALYZING ${symbol}...`);
        
        // Check if we already have too many positions for this pair
        const hasOpenPosition = await this.positionChecker.hasOpenPosition(symbol);
        if (hasOpenPosition) {
          console.log(`⏭️  SKIPPING ${symbol} - already has open position`);
          continue;
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

        const currentPrice = parseFloat(latestPrice.price);
        console.log(`💰 Current price for ${symbol}: $${currentPrice.toFixed(4)}`);

        // Create a simplified support level for signal generation
        // This ensures we always have a support level to work with
        const supportLevelPrice = currentPrice * 0.995; // Support 0.5% below current price
        const supportLevel = {
          price: supportLevelPrice,
          strength: 0.8,
          touchCount: 3
        };

        console.log(`🎯 Using support level: $${supportLevelPrice.toFixed(4)} (0.5% below current price)`);
        
        // Generate signal with relaxed conditions
        const signal = await this.signalGenerator.generateSignal(symbol, currentPrice, supportLevel);
        
        if (signal) {
          console.log(`🚀 SIGNAL GENERATED for ${symbol}!`);
        } else {
          console.log(`📭 No signal generated for ${symbol}`);
        }
        
      } catch (error) {
        console.error(`❌ Error analyzing ${symbol}:`, error);
        await this.logActivity('analysis_error', `Analysis failed for ${symbol}`, { 
          error: error instanceof Error ? error.message : 'Unknown error',
          symbol 
        });
      }
    }
    
    console.log('✅ SIGNAL ANALYSIS COMPLETED\n');
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
