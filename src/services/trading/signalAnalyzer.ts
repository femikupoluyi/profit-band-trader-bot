
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
    // Use valid trading pairs
    const validSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'MATICUSDT', 'LTCUSDT'];
    const symbols = this.config.trading_pairs?.filter(symbol => validSymbols.includes(symbol)) || validSymbols.slice(0, 5);
    
    console.log('Analyzing symbols for signals:', symbols);
    
    for (const symbol of symbols) {
      try {
        // Check if we already have an open position for this pair
        const hasOpenPosition = await this.positionChecker.hasOpenPosition(symbol);
        if (hasOpenPosition) {
          console.log(`Skipping ${symbol} - already has open position`);
          continue;
        }

        // Get available candle data (reduced requirement to work with what we have)
        const candles = await this.candleDataService.getCandleData(symbol, 20);
        if (!candles || candles.length < 10) {
          console.log(`Not enough candle data for ${symbol} (${candles?.length || 0} candles), creating test signal anyway`);
          
          // Create a test signal even without full historical data
          await this.createTestSignal(symbol);
          continue;
        }

        console.log(`Analyzing ${symbol} with ${candles.length} candles`);

        // Identify support level
        const supportLevel = this.supportLevelAnalyzer.identifySupportLevel(candles);
        if (!supportLevel) {
          console.log(`No clear support level found for ${symbol}, creating simplified signal`);
          await this.createTestSignal(symbol);
          continue;
        }

        // Get current price
        const { data: latestPrice } = await (supabase as any)
          .from('market_data')
          .select('price')
          .eq('symbol', symbol)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (!latestPrice) {
          console.log(`No current price data for ${symbol}`);
          continue;
        }

        const currentPrice = parseFloat(latestPrice.price);
        
        // Generate signal if conditions are met
        await this.signalGenerator.generateSignal(symbol, currentPrice, supportLevel);
      } catch (error) {
        console.error(`Error analyzing ${symbol}:`, error);
        await this.logActivity('error', `Analysis failed for ${symbol}`, { error: error.message });
      }
    }
  }

  private async createTestSignal(symbol: string): Promise<void> {
    try {
      // Get current price
      const { data: latestPrice } = await (supabase as any)
        .from('market_data')
        .select('price')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (!latestPrice) return;

      const currentPrice = parseFloat(latestPrice.price);
      
      // Create a simplified support level based on current price
      const supportLevel = {
        price: currentPrice * 0.995, // 0.5% below current price
        strength: 0.7,
        touchCount: 3
      };

      console.log(`Creating test signal for ${symbol} at price ${currentPrice}`);
      await this.signalGenerator.generateSignal(symbol, currentPrice, supportLevel);
    } catch (error) {
      console.error(`Error creating test signal for ${symbol}:`, error);
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await (supabase as any)
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
