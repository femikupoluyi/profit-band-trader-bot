
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

      // CRITICAL: Always ensure sufficient data before any analysis
      await this.ensureSufficientDataForAllSymbols(config.trading_pairs, config.support_candle_count || 128);

      // Perform regular market scanning to add fresh data
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

  private async ensureSufficientDataForAllSymbols(symbols: string[], minRequired: number): Promise<void> {
    try {
      console.log('\n🔍 ENSURING SUFFICIENT MARKET DATA FOR ALL SYMBOLS...');
      console.log(`📊 Minimum required records per symbol: ${minRequired}`);
      
      for (const symbol of symbols) {
        await this.ensureSufficientDataForSymbol(symbol, minRequired);
      }
      
      console.log('✅ ALL SYMBOLS DATA VERIFICATION COMPLETE');

    } catch (error) {
      console.error('❌ Error ensuring sufficient data:', error);
      await this.logger.logError('Failed to ensure sufficient market data', error);
      throw error; // Throw error to prevent analysis with insufficient data
    }
  }

  private async ensureSufficientDataForSymbol(symbol: string, minRequired: number): Promise<void> {
    try {
      console.log(`\n🔍 CHECKING DATA FOR ${symbol}...`);
      
      // Check current data count
      const { count: existingCount, error } = await (globalThis as any).supabase
        .from('market_data')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', symbol);

      if (error) {
        console.error(`❌ Error checking data count for ${symbol}:`, error);
        throw error;
      }

      const actualCount = existingCount || 0;
      console.log(`📊 ${symbol}: Current records: ${actualCount}, Required: ${minRequired}`);

      if (actualCount < minRequired) {
        const needed = minRequired - actualCount;
        console.log(`🌱 ${symbol}: SEEDING ${needed} additional records...`);
        
        // Seed data with a buffer (150% of required to avoid frequent seeding)
        const seedTarget = Math.max(minRequired * 1.5, 50);
        await this.seeder.seedSymbolData(symbol, Math.ceil(seedTarget));
        
        // Verify seeding was successful
        const { count: verifyCount } = await (globalThis as any).supabase
          .from('market_data')
          .select('*', { count: 'exact', head: true })
          .eq('symbol', symbol);
        
        const finalCount = verifyCount || 0;
        console.log(`✅ ${symbol}: Post-seed verification: ${finalCount} records`);
        
        if (finalCount < minRequired) {
          console.error(`❌ ${symbol}: Still insufficient data after seeding (${finalCount} < ${minRequired})`);
          throw new Error(`Failed to seed sufficient data for ${symbol}`);
        }
      } else {
        console.log(`✅ ${symbol}: Already has sufficient data (${actualCount} >= ${minRequired})`);
      }

    } catch (error) {
      console.error(`❌ Error ensuring data for ${symbol}:`, error);
      throw error;
    }
  }
}
