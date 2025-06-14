
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

      // CRITICAL: Ensure we have sufficient data before analysis
      await this.ensureSufficientData(config.trading_pairs, config.support_candle_count || 128);

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

  private async ensureSufficientData(symbols: string[], minRequired: number): Promise<void> {
    try {
      console.log('\n🔍 ENSURING SUFFICIENT MARKET DATA...');
      
      const symbolsNeedingData: string[] = [];
      
      // Check each symbol for sufficient data
      for (const symbol of symbols) {
        const { count: existingCount, error } = await (globalThis as any).supabase
          .from('market_data')
          .select('*', { count: 'exact', head: true })
          .eq('symbol', symbol);

        if (error) {
          console.error(`❌ Error checking data for ${symbol}:`, error);
          symbolsNeedingData.push(symbol);
          continue;
        }

        const actualCount = existingCount || 0;
        console.log(`📊 ${symbol}: ${actualCount} existing records (need ${minRequired})`);

        if (actualCount < minRequired) {
          symbolsNeedingData.push(symbol);
          console.log(`⚠️ ${symbol}: Needs data seeding (${actualCount} < ${minRequired})`);
        }
      }

      if (symbolsNeedingData.length > 0) {
        console.log(`🌱 CRITICAL: Seeding data for ${symbolsNeedingData.length} symbols: ${symbolsNeedingData.join(', ')}`);
        
        // Seed more data than minimum to have buffer
        const seedTarget = Math.max(minRequired, 50);
        await this.seeder.seedInitialMarketData(symbolsNeedingData, seedTarget);
        
        console.log('✅ Data seeding completed, verifying...');
        
        // Verify seeding was successful
        for (const symbol of symbolsNeedingData) {
          const { count: verifyCount } = await (globalThis as any).supabase
            .from('market_data')
            .select('*', { count: 'exact', head: true })
            .eq('symbol', symbol);
          
          console.log(`✅ ${symbol}: Verification count: ${verifyCount || 0}`);
        }
      } else {
        console.log('✅ All symbols have sufficient market data');
      }

    } catch (error) {
      console.error('❌ Error ensuring sufficient data:', error);
      await this.logger.logError('Failed to ensure sufficient market data', error);
      // Don't throw - allow scanning to continue with whatever data exists
    }
  }
}
