
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
    const symbols = this.config.trading_pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 'POLUSDT', 'FETUSDT', 'XRPUSDT', 'XLMUSDT'];
    
    for (const symbol of symbols) {
      try {
        // Check if we already have an open position for this pair
        const hasOpenPosition = await this.positionChecker.hasOpenPosition(symbol);
        if (hasOpenPosition) {
          console.log(`Skipping ${symbol} - already has open position`);
          continue;
        }

        // Get 72 candles of historical data
        const candles = await this.candleDataService.getCandleData(symbol, 72);
        if (!candles || candles.length < 72) {
          console.log(`Not enough candle data for ${symbol}`);
          continue;
        }

        // Identify support level
        const supportLevel = this.supportLevelAnalyzer.identifySupportLevel(candles);
        if (!supportLevel) {
          console.log(`No clear support level found for ${symbol}`);
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

        if (!latestPrice) continue;

        const currentPrice = parseFloat(latestPrice.price);
        
        // Generate signal if conditions are met
        await this.signalGenerator.generateSignal(symbol, currentPrice, supportLevel);
      } catch (error) {
        console.error(`Error analyzing ${symbol}:`, error);
      }
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
