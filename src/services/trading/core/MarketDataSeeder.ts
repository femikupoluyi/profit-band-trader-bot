
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

  async seedSymbolData(symbol: string, targetRecords: number): Promise<void> {
    try {
      console.log(`\n🌱 SEEDING DATA FOR ${symbol}...`);
      console.log(`🎯 Target: ${targetRecords} records`);

      // Get current market price as base for historical data
      const currentMarketData = await this.bybitService.getMarketPrice(symbol);
      const basePrice = currentMarketData.price;
      console.log(`💰 ${symbol}: Base price for seeding: $${basePrice.toFixed(6)}`);

      // Generate historical data points
      const seedData = [];
      const now = Date.now();
      
      // Generate data going backwards in time (5-minute intervals)
      for (let i = 0; i < targetRecords; i++) {
        const minutesBack = (targetRecords - i) * 5;
        const timestamp = new Date(now - (minutesBack * 60 * 1000));
        
        // Create realistic price variations (random walk)
        const volatility = 0.005; // 0.5% max variation per step
        const randomFactor = (Math.random() - 0.5) * 2;
        const priceVariation = 1 + (randomFactor * volatility * (i / targetRecords));
        const historicalPrice = basePrice * priceVariation;
        
        // Ensure price is positive and reasonable (within 10% of base)
        const finalPrice = Math.max(historicalPrice, basePrice * 0.9);
        const cappedPrice = Math.min(finalPrice, basePrice * 1.1);
        
        // Generate realistic volume
        const baseVolume = 100000;
        const volumeVariation = Math.random() * 0.8 + 0.2; // 20% to 100% of base
        const volume = baseVolume * volumeVariation;

        seedData.push({
          symbol,
          price: cappedPrice,
          volume: volume,
          timestamp: timestamp.toISOString(),
          source: 'seeded_historical_data'
        });
      }

      // Sort by timestamp to maintain chronological order
      seedData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      console.log(`📝 ${symbol}: Generated ${seedData.length} historical data points`);
      console.log(`📊 ${symbol}: Price range: $${Math.min(...seedData.map(d => d.price)).toFixed(6)} - $${Math.max(...seedData.map(d => d.price)).toFixed(6)}`);

      // Insert data in batches to avoid timeout
      const batchSize = 10;
      let insertedCount = 0;
      
      for (let i = 0; i < seedData.length; i += batchSize) {
        const batch = seedData.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('market_data')
          .insert(batch);

        if (insertError) {
          console.error(`❌ Error inserting batch for ${symbol}:`, insertError);
          // Continue with other batches
        } else {
          insertedCount += batch.length;
          const progress = Math.round((insertedCount / seedData.length) * 100);
          console.log(`📊 ${symbol}: Seeded ${insertedCount}/${seedData.length} records (${progress}%)`);
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`✅ ${symbol}: Successfully seeded ${insertedCount} historical records`);

      await this.logger.logSuccess(`Market data seeded for ${symbol}`, {
        symbol,
        recordsSeeded: insertedCount,
        basePrice,
        targetRecords,
        actualSeeded: insertedCount
      });

    } catch (error) {
      console.error(`❌ Error seeding data for ${symbol}:`, error);
      await this.logger.logError(`Failed to seed market data for ${symbol}`, error, { symbol });
      throw error;
    }
  }
}
