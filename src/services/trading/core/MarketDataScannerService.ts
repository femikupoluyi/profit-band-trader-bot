
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
      
      // Check current data count using proper supabase client
      const { count: existingCount, error } = await supabase
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
        
        // Force seeding with sufficient data
        const seedTarget = Math.max(minRequired + 20, 50); // Add buffer
        console.log(`🔥 ${symbol}: FORCE SEEDING ${seedTarget} records to ensure sufficiency...`);
        
        await this.seeder.seedSymbolData(symbol, seedTarget);
        
        // Verify seeding was successful with retry logic
        let retryCount = 0;
        const maxRetries = 3;
        let finalCount = 0;
        
        while (retryCount < maxRetries) {
          const { count: verifyCount, error: verifyError } = await supabase
            .from('market_data')
            .select('*', { count: 'exact', head: true })
            .eq('symbol', symbol);
          
          if (verifyError) {
            console.error(`❌ Error verifying data for ${symbol}:`, verifyError);
            throw verifyError;
          }
          
          finalCount = verifyCount || 0;
          console.log(`🔍 ${symbol}: Post-seed verification attempt ${retryCount + 1}: ${finalCount} records`);
          
          if (finalCount >= minRequired) {
            console.log(`✅ ${symbol}: Successfully seeded sufficient data (${finalCount} >= ${minRequired})`);
            break;
          }
          
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`⚠️ ${symbol}: Retry ${retryCount} - Still insufficient data, seeding again...`);
            await this.seeder.seedSymbolData(symbol, seedTarget);
            // Small delay between retries
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (finalCount < minRequired) {
          const errorMsg = `CRITICAL: ${symbol} still has insufficient data after ${maxRetries} seeding attempts (${finalCount} < ${minRequired})`;
          console.error(`🚨 ${errorMsg}`);
          throw new Error(errorMsg);
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
