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

  async ensureSufficientData(symbol: string, requiredCount: number): Promise<boolean> {
    try {
      console.log(`🔍 Ensuring sufficient data for ${symbol} (need ${requiredCount} records)...`);
      
      // Check current count
      const { count: currentCount, error } = await supabase
        .from('market_data')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', symbol);

      if (error) {
        console.error(`❌ Error checking data count for ${symbol}:`, error);
        return false;
      }

      const actualCount = currentCount || 0;
      console.log(`📊 ${symbol}: Has ${actualCount} records, needs ${requiredCount}`);

      if (actualCount < requiredCount) {
        console.log(`🚨 ${symbol}: Need more data, seeding...`);
        await this.seeder.seedSymbolDataFast(symbol, requiredCount);
        return true;
      }

      console.log(`✅ ${symbol}: Has sufficient data`);
      return true;
    } catch (error) {
      console.error(`❌ Error ensuring sufficient data for ${symbol}:`, error);
      return false;
    }
  }

  async scanMarkets(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n📈 ===== OPTIMIZED MARKET DATA SCANNING START =====');
      console.log(`🎯 Target symbols: ${config.trading_pairs.join(', ')}`);
      console.log(`📊 Required data points for analysis: ${config.support_candle_count || 128}`);

      // STEP 1: Quick check and minimal seeding
      console.log('\n🚀 STEP 1: FAST MARKET DATA INITIALIZATION...');
      const minRequiredForTrading = Math.min(config.support_candle_count || 128, 50); // Use 50 as minimum
      await this.seeder.seedInitialMarketData(config.trading_pairs, minRequiredForTrading);
      
      // STEP 2: Quick verification - only check critical symbols
      console.log('\n🔍 STEP 2: QUICK DATA VERIFICATION...');
      const criticalSymbols = config.trading_pairs.slice(0, 3); // Only verify first 3 symbols for speed
      for (const symbol of criticalSymbols) {
        await this.quickVerifySymbolData(symbol, minRequiredForTrading);
      }

      // STEP 3: Add fresh market data points (non-blocking)
      console.log('\n📊 STEP 3: ADDING FRESH MARKET DATA POINTS...');
      const scanner = new MarketScanner(this.userId, this.bybitService, config);
      await scanner.scanMarkets();

      console.log('✅ ===== OPTIMIZED MARKET DATA SCANNING COMPLETE =====');
      
      await this.logger.logSuccess('Optimized market data scanning completed', {
        symbolsScanned: config.trading_pairs.length,
        symbols: config.trading_pairs,
        targetDataPoints: minRequiredForTrading
      });

    } catch (error) {
      console.error('❌ Error in optimized market data scanning:', error);
      await this.logger.logError('Optimized market data scanning failed', error);
      throw error;
    }
  }

  private async quickVerifySymbolData(symbol: string, minRequired: number): Promise<void> {
    try {
      console.log(`\n🔍 QUICK VERIFY ${symbol}...`);
      
      // Get current count
      const { count: currentCount, error } = await supabase
        .from('market_data')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', symbol);

      if (error) {
        console.error(`❌ Error checking data count for ${symbol}:`, error);
        return; // Don't throw, just continue
      }

      const actualCount = currentCount || 0;
      console.log(`📊 ${symbol}: Records: ${actualCount}, Required: ${minRequired}`);

      if (actualCount < minRequired) {
        console.log(`🚨 ${symbol}: Need more data, quick seeding...`);
        await this.seeder.seedSymbolDataFast(symbol, minRequired);
      } else {
        console.log(`✅ ${symbol}: Data verification passed`);
      }
    } catch (error) {
      console.error(`❌ Error verifying data for ${symbol}:`, error);
      // Don't throw - continue with other symbols
    }
  }

  // Background method to gradually build up more data (can be called later)
  async expandMarketDataAsync(config: TradingConfigData): Promise<void> {
    console.log('\n🔄 Background expansion of market data...');
    const fullTarget = config.support_candle_count || 128;
    
    // Run this in background without blocking
    setTimeout(async () => {
      try {
        await this.seeder.seedInitialMarketData(config.trading_pairs, fullTarget);
        console.log('✅ Background market data expansion completed');
      } catch (error) {
        console.error('❌ Background market data expansion failed:', error);
      }
    }, 5000); // Start after 5 seconds
  }
}
