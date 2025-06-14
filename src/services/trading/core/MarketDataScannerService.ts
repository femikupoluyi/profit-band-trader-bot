
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { MarketScanner } from '../marketScanner';
import { MarketDataSeeder } from './MarketDataSeeder';
import { TradingLogger } from './TradingLogger';

export class MarketDataScannerService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private seeder: MarketDataSeeder;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.seeder = new MarketDataSeeder(userId, bybitService);
  }

  async scanMarkets(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n📈 ===== MARKET DATA SCANNING START =====');
      console.log(`🎯 Target symbols: ${config.trading_pairs.join(', ')}`);
      console.log(`📊 Required data points for analysis: ${config.support_candle_count || 128}`);

      // Check if we need to seed initial data for new symbols
      await this.seedDataIfNeeded(config.trading_pairs);

      // Perform regular market scanning
      const scanner = new MarketScanner(this.userId, this.bybitService, config);
      await scanner.scanMarkets();

      console.log('✅ ===== MARKET DATA SCANNING COMPLETE =====');
      
      await this.logger.logSuccess('Market data scanning completed', {
        symbolsScanned: config.trading_pairs.length,
        symbols: config.trading_pairs,
        targetDataPoints: config.support_candle_count
      });

    } catch (error) {
      console.error('❌ Error in market data scanning:', error);
      await this.logger.logError('Market data scanning failed', error);
      throw error;
    }
  }

  private async seedDataIfNeeded(symbols: string[]): Promise<void> {
    try {
      console.log('\n🌱 Checking if market data seeding is needed...');
      
      const symbolsNeedingData: string[] = [];
      
      // Check each symbol for sufficient data
      for (const symbol of symbols) {
        const { data: existingData } = await (globalThis as any).supabase
          .from('market_data')
          .select('id', { count: 'exact' })
          .eq('symbol', symbol);

        const existingCount = existingData?.length || 0;
        console.log(`📊 ${symbol}: ${existingCount} existing records`);

        if (existingCount < 10) {
          symbolsNeedingData.push(symbol);
          console.log(`⚠️ ${symbol}: Needs data seeding (${existingCount} < 10 minimum)`);
        }
      }

      if (symbolsNeedingData.length > 0) {
        console.log(`🌱 Seeding data for ${symbolsNeedingData.length} symbols: ${symbolsNeedingData.join(', ')}`);
        await this.seeder.seedInitialMarketData(symbolsNeedingData, 50);
      } else {
        console.log('✅ All symbols have sufficient market data');
      }

    } catch (error) {
      console.error('❌ Error checking/seeding market data:', error);
      // Don't throw - allow normal scanning to continue
    }
  }
}
