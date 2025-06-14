
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { MarketScanner } from '../marketScanner';
import { MarketDataSeeder } from './MarketDataSeeder';
import { TradingLogger } from './TradingLogger';
import { supabase } from '@/integrations/supabase/client';

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

      // STEP 1: Force seed all symbols with sufficient data FIRST
      console.log('\n🌱 STEP 1: FORCE SEEDING ALL SYMBOLS WITH HISTORICAL DATA...');
      await this.seeder.seedInitialMarketData(config.trading_pairs, config.support_candle_count || 128);
      
      // STEP 2: Verify seeding worked for all symbols
      console.log('\n🔍 STEP 2: VERIFYING SEEDED DATA FOR ALL SYMBOLS...');
      for (const symbol of config.trading_pairs) {
        await this.verifySymbolDataAfterSeeding(symbol, config.support_candle_count || 128);
      }

      // STEP 3: Add fresh market data points
      console.log('\n📊 STEP 3: ADDING FRESH MARKET DATA POINTS...');
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

  private async verifySymbolDataAfterSeeding(symbol: string, minRequired: number): Promise<void> {
    try {
      console.log(`\n🔍 VERIFYING DATA FOR ${symbol} AFTER SEEDING...`);
      
      // Get current count
      const { count: currentCount, error } = await supabase
        .from('market_data')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', symbol);

      if (error) {
        console.error(`❌ Error checking data count for ${symbol}:`, error);
        throw error;
      }

      const actualCount = currentCount || 0;
      console.log(`📊 ${symbol}: Current records after seeding: ${actualCount}, Required: ${minRequired}`);

      if (actualCount < minRequired) {
        console.log(`🚨 ${symbol}: CRITICAL - Still insufficient data after seeding! Attempting emergency re-seed...`);
        
        // Emergency re-seed with double the target
        const emergencyTarget = minRequired * 2;
        console.log(`🔥 ${symbol}: EMERGENCY SEEDING ${emergencyTarget} records...`);
        await this.seeder.seedSymbolData(symbol, emergencyTarget);
        
        // Verify emergency seeding
        const { count: finalCount, error: finalError } = await supabase
          .from('market_data')
          .select('*', { count: 'exact', head: true })
          .eq('symbol', symbol);
        
        if (finalError) {
          throw finalError;
        }
        
        const finalActualCount = finalCount || 0;
        console.log(`🔍 ${symbol}: Post-emergency seeding count: ${finalActualCount}`);
        
        if (finalActualCount < minRequired) {
          throw new Error(`CRITICAL: ${symbol} still has insufficient data after emergency seeding (${finalActualCount} < ${minRequired})`);
        }
        
        console.log(`✅ ${symbol}: Emergency seeding successful!`);
      } else {
        console.log(`✅ ${symbol}: Data verification passed (${actualCount} >= ${minRequired})`);
      }
    } catch (error) {
      console.error(`❌ Error verifying data for ${symbol}:`, error);
      throw error;
    }
  }
}
