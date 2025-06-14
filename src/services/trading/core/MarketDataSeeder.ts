
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
      try {
        console.log(`\n🔄 Processing ${symbol}...`);
        
        // Check existing data first
        const { count: existingCount } = await supabase
          .from('market_data')
          .select('*', { count: 'exact', head: true })
          .eq('symbol', symbol);
        
        const currentCount = existingCount || 0;
        console.log(`📊 ${symbol}: Current records: ${currentCount}, Target: ${targetRecords}`);
        
        if (currentCount < targetRecords) {
          console.log(`🌱 ${symbol}: Seeding ${targetRecords} records...`);
          await this.seedSymbolData(symbol, targetRecords);
        } else {
          console.log(`✅ ${symbol}: Already has sufficient data (${currentCount} >= ${targetRecords})`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${symbol}:`, error);
        // Continue with other symbols even if one fails
      }
    }

    console.log('✅ MARKET DATA SEEDING COMPLETED');
  }

  async seedSymbolData(symbol: string, targetRecords: number): Promise<void> {
    try {
      console.log(`\n🌱 SEEDING DATA FOR ${symbol}...`);
      console.log(`🎯 Target: ${targetRecords} records`);

      // Clear any existing data for this symbol to avoid confusion
      console.log(`🧹 ${symbol}: Clearing existing data to ensure clean seeding...`);
      const { error: deleteError } = await supabase
        .from('market_data')
        .delete()
        .eq('symbol', symbol);
      
      if (deleteError) {
        console.error(`⚠️ ${symbol}: Could not clear existing data:`, deleteError);
        // Continue anyway
      }

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
        const volatility = 0.01; // 1% max variation per step
        const randomFactor = (Math.random() - 0.5) * 2;
        const priceVariation = 1 + (randomFactor * volatility * (i / targetRecords));
        const historicalPrice = basePrice * priceVariation;
        
        // Ensure price is positive and reasonable (within 15% of base)
        const finalPrice = Math.max(historicalPrice, basePrice * 0.85);
        const cappedPrice = Math.min(finalPrice, basePrice * 1.15);
        
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

      // Insert data in smaller batches to avoid conflicts
      const batchSize = 5;
      let insertedCount = 0;
      
      for (let i = 0; i < seedData.length; i += batchSize) {
        const batch = seedData.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('market_data')
          .insert(batch);

        if (insertError) {
          console.error(`❌ Error inserting batch for ${symbol}:`, insertError);
          // Try individual inserts for this batch
          for (const record of batch) {
            try {
              const { error: singleError } = await supabase
                .from('market_data')
                .insert([record]);
              
              if (!singleError) {
                insertedCount++;
              }
            } catch (singleInsertError) {
              console.error(`❌ Single insert failed for ${symbol}:`, singleInsertError);
            }
          }
        } else {
          insertedCount += batch.length;
          const progress = Math.round((insertedCount / seedData.length) * 100);
          console.log(`📊 ${symbol}: Seeded ${insertedCount}/${seedData.length} records (${progress}%)`);
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verify final count
      const { count: finalCount } = await supabase
        .from('market_data')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', symbol);

      console.log(`✅ ${symbol}: Seeding completed. Final count: ${finalCount || 0}, Target was: ${targetRecords}`);

      await this.logger.logSuccess(`Market data seeded for ${symbol}`, {
        symbol,
        recordsSeeded: insertedCount,
        finalCount: finalCount || 0,
        basePrice,
        targetRecords
      });

    } catch (error) {
      console.error(`❌ Error seeding data for ${symbol}:`, error);
      await this.logger.logError(`Failed to seed market data for ${symbol}`, error, { symbol });
      throw error;
    }
  }
}
