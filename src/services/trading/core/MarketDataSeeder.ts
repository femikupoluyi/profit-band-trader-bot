
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';

export class MarketDataSeeder {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
  }

  async seedInitialMarketData(symbols: string[], targetRecords: number = 50): Promise<void> {
    console.log(`🌱 SEEDING INITIAL MARKET DATA for ${symbols.length} symbols...`);
    console.log(`🎯 Target records per symbol: ${targetRecords}`);

    for (const symbol of symbols) {
      await this.seedSymbolData(symbol, targetRecords);
    }

    console.log('✅ MARKET DATA SEEDING COMPLETED');
  }

  private async seedSymbolData(symbol: string, targetRecords: number): Promise<void> {
    try {
      console.log(`\n🌱 Seeding data for ${symbol}...`);

      // Check existing data with proper count
      const { count: existingCount, error: countError } = await supabase
        .from('market_data')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', symbol);

      if (countError) {
        console.error(`❌ Error checking existing data for ${symbol}:`, countError);
        throw countError;
      }

      const currentCount = existingCount || 0;
      console.log(`📊 ${symbol}: Found ${currentCount} existing records`);

      if (currentCount >= targetRecords) {
        console.log(`✅ ${symbol}: Already has sufficient data (${currentCount}/${targetRecords})`);
        return;
      }

      // Get current market price as base
      const currentMarketData = await this.bybitService.getMarketPrice(symbol);
      const basePrice = currentMarketData.price;
      console.log(`💰 ${symbol}: Base price: $${basePrice.toFixed(6)}`);

      // Generate historical data points
      const recordsToGenerate = targetRecords - currentCount;
      console.log(`🔢 ${symbol}: Generating ${recordsToGenerate} historical records...`);

      const seedData = [];
      const now = Date.now();
      
      // Generate data going backwards in time to simulate history
      for (let i = 0; i < recordsToGenerate; i++) {
        // Generate timestamps going backwards (5-minute intervals)
        const minutesBack = (recordsToGenerate - i) * 5;
        const timestamp = new Date(now - (minutesBack * 60 * 1000));
        
        // Generate realistic price variations using random walk
        const volatility = 0.02; // 2% max variation per step
        const priceChange = (Math.random() - 0.5) * 2 * volatility;
        const historicalPrice = basePrice * (1 + priceChange * (i / recordsToGenerate));
        
        // Ensure price is positive and reasonable
        const finalPrice = Math.max(historicalPrice, basePrice * 0.5);
        
        // Generate realistic volume
        const baseVolume = 100000;
        const volumeVariation = Math.random() * 0.8 + 0.2; // 20% to 100% of base
        const volume = baseVolume * volumeVariation;

        seedData.push({
          symbol,
          price: finalPrice,
          volume: volume,
          timestamp: timestamp.toISOString(),
          source: 'seeded_historical_data'
        });
      }

      // Sort by timestamp to maintain chronological order
      seedData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Insert data in smaller batches to avoid timeout
      const batchSize = 5;
      let insertedCount = 0;
      
      for (let i = 0; i < seedData.length; i += batchSize) {
        const batch = seedData.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('market_data')
          .insert(batch);

        if (insertError) {
          console.error(`❌ Error inserting batch for ${symbol}:`, insertError);
          await this.logger.logError(`Failed to seed data batch for ${symbol}`, insertError, { symbol, batchIndex: i });
        } else {
          insertedCount += batch.length;
          console.log(`📊 ${symbol}: Inserted batch ${Math.floor(i / batchSize) + 1}, total: ${insertedCount}/${recordsToGenerate}`);
        }

        // Small delay between batches to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ ${symbol}: Seeded ${insertedCount} historical records`);
      console.log(`📊 ${symbol}: Total records now: ${currentCount + insertedCount}`);

      await this.logger.logSuccess(`Market data seeded for ${symbol}`, {
        symbol,
        recordsSeeded: insertedCount,
        totalRecords: currentCount + insertedCount,
        basePrice,
        targetRecords
      });

    } catch (error) {
      console.error(`❌ Error seeding data for ${symbol}:`, error);
      await this.logger.logError(`Failed to seed market data for ${symbol}`, error, { symbol });
    }
  }
}
