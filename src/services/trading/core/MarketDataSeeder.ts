
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

      // Check existing data
      const { data: existingData, error: countError } = await supabase
        .from('market_data')
        .select('id', { count: 'exact' })
        .eq('symbol', symbol);

      const existingCount = existingData?.length || 0;
      console.log(`📊 ${symbol}: Found ${existingCount} existing records`);

      if (existingCount >= targetRecords) {
        console.log(`✅ ${symbol}: Already has sufficient data (${existingCount}/${targetRecords})`);
        return;
      }

      // Get current market price as base
      const currentMarketData = await this.bybitService.getMarketPrice(symbol);
      const basePrice = currentMarketData.price;
      console.log(`💰 ${symbol}: Base price: $${basePrice.toFixed(6)}`);

      // Generate historical data points
      const recordsToGenerate = targetRecords - existingCount;
      console.log(`🔢 ${symbol}: Generating ${recordsToGenerate} historical records...`);

      const seedData = [];
      const now = Date.now();
      
      for (let i = 0; i < recordsToGenerate; i++) {
        // Generate timestamps going backwards (newer to older)
        const minutesBack = i * 5; // 5-minute intervals
        const timestamp = new Date(now - (minutesBack * 60 * 1000));
        
        // Generate realistic price variations (±2% random walk)
        const priceVariation = 1 + ((Math.random() - 0.5) * 0.04); // ±2%
        const historicalPrice = basePrice * priceVariation;
        
        // Generate volume
        const volume = Math.random() * 1000000;

        seedData.push({
          symbol,
          price: historicalPrice,
          volume,
          timestamp: timestamp.toISOString(),
          source: 'seeded_historical_data'
        });
      }

      // Insert seeded data in batches
      const batchSize = 10;
      for (let i = 0; i < seedData.length; i += batchSize) {
        const batch = seedData.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('market_data')
          .insert(batch);

        if (insertError) {
          console.error(`❌ Error inserting batch for ${symbol}:`, insertError);
          await this.logger.logError(`Failed to seed data batch for ${symbol}`, insertError, { symbol });
        }
      }

      console.log(`✅ ${symbol}: Seeded ${recordsToGenerate} historical records`);
      console.log(`📊 ${symbol}: Total records now: ${existingCount + recordsToGenerate}`);

      await this.logger.logSuccess(`Market data seeded for ${symbol}`, {
        symbol,
        recordsSeeded: recordsToGenerate,
        totalRecords: existingCount + recordsToGenerate,
        basePrice
      });

    } catch (error) {
      console.error(`❌ Error seeding data for ${symbol}:`, error);
      await this.logger.logError(`Failed to seed market data for ${symbol}`, error, { symbol });
    }
  }
}
