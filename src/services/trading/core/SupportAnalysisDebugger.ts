
import { supabase } from '@/integrations/supabase/client';
import { CandleDataService } from '../candleDataService';
import { SupportLevelAnalyzer } from '../supportLevelAnalyzer';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export class SupportAnalysisDebugger {
  private candleDataService: CandleDataService;
  private supportAnalyzer: SupportLevelAnalyzer;

  constructor() {
    this.candleDataService = new CandleDataService();
    this.supportAnalyzer = new SupportLevelAnalyzer();
  }

  async debugSupportAnalysis(symbol: string, config: TradingConfigData): Promise<void> {
    console.log(`\n🔍 ===== DEBUGGING SUPPORT ANALYSIS FOR ${symbol} =====`);
    
    // Get configuration values
    const chartTimeframe = config.chart_timeframe || '4h';
    const supportCandleCount = config.support_candle_count || 128;
    
    console.log(`📊 Configuration:`);
    console.log(`  - Chart Timeframe: ${chartTimeframe}`);
    console.log(`  - Support Candle Count: ${supportCandleCount}`);

    // Step 1: Get candle data
    console.log(`\n🕯️ Step 1: Fetching candle data...`);
    const candles = await this.candleDataService.getCandleData(symbol, supportCandleCount);
    
    console.log(`📈 Candle Data Summary:`);
    console.log(`  - Total candles retrieved: ${candles.length}`);
    
    if (candles.length === 0) {
      console.log(`❌ No candle data available for ${symbol}`);
      return;
    }

    // Show first few and last few candles
    console.log(`\n📊 First 5 candles:`);
    candles.slice(0, 5).forEach((candle, i) => {
      const date = new Date(candle.timestamp).toISOString();
      console.log(`  ${i + 1}. ${date}: O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close} V=${candle.volume}`);
    });

    console.log(`\n📊 Last 5 candles:`);
    candles.slice(-5).forEach((candle, i) => {
      const date = new Date(candle.timestamp).toISOString();
      console.log(`  ${candles.length - 4 + i}. ${date}: O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close} V=${candle.volume}`);
    });

    // Step 2: Extract and analyze low prices
    console.log(`\n📉 Step 2: Analyzing low prices...`);
    const lowPrices = candles.map(c => c.low).sort((a, b) => a - b);
    
    console.log(`💰 Price Range Analysis:`);
    console.log(`  - Lowest low: $${Math.min(...lowPrices).toFixed(2)}`);
    console.log(`  - Highest low: $${Math.max(...lowPrices).toFixed(2)}`);
    console.log(`  - Current price (last close): $${candles[candles.length - 1]?.close.toFixed(2)}`);

    // Step 3: Group prices into clusters
    console.log(`\n🔗 Step 3: Clustering similar prices...`);
    const priceGroups: { [key: string]: { count: number; prices: number[] } } = {};
    
    for (const price of lowPrices) {
      const key = Math.round(price * 200) / 200; // Round to nearest 0.005
      if (!priceGroups[key]) {
        priceGroups[key] = { count: 0, prices: [] };
      }
      priceGroups[key].count++;
      priceGroups[key].prices.push(price);
    }

    // Step 4: Find clusters with most touches
    console.log(`\n🎯 Step 4: Finding support clusters...`);
    const sortedClusters = Object.entries(priceGroups)
      .map(([priceStr, data]) => ({
        price: parseFloat(priceStr),
        touches: data.count,
        averagePrice: data.prices.reduce((sum, p) => sum + p, 0) / data.prices.length,
        priceRange: {
          min: Math.min(...data.prices),
          max: Math.max(...data.prices)
        }
      }))
      .filter(cluster => cluster.touches >= 2) // Minimum 2 touches
      .sort((a, b) => b.touches - a.touches); // Sort by most touches

    console.log(`🏆 Top 10 Support Clusters (by touch count):`);
    sortedClusters.slice(0, 10).forEach((cluster, i) => {
      const strength = cluster.touches / candles.length;
      console.log(`  ${i + 1}. $${cluster.averagePrice.toFixed(2)} (${cluster.touches} touches, ${(strength * 100).toFixed(1)}% strength)`);
      console.log(`     Range: $${cluster.priceRange.min.toFixed(2)} - $${cluster.priceRange.max.toFixed(2)}`);
    });

    // Step 5: Use the actual SupportLevelAnalyzer
    console.log(`\n🧮 Step 5: Using SupportLevelAnalyzer...`);
    const supportLevel = this.supportAnalyzer.identifySupportLevel(candles);
    
    if (supportLevel) {
      console.log(`✅ Identified Support Level:`);
      console.log(`  - Price: $${supportLevel.price.toFixed(2)}`);
      console.log(`  - Strength: ${supportLevel.strength.toFixed(4)}`);
      console.log(`  - Touches: ${supportLevel.touches}`);
      console.log(`  - Touch Count: ${supportLevel.touchCount}`);
      
      const currentPrice = candles[candles.length - 1]?.close || 0;
      const distancePercent = ((currentPrice - supportLevel.price) / currentPrice) * 100;
      console.log(`  - Distance from current price: ${distancePercent.toFixed(2)}%`);
    } else {
      console.log(`❌ No support level identified by SupportLevelAnalyzer`);
    }

    // Step 6: Check raw market data from database
    console.log(`\n🗄️ Step 6: Checking raw market data from database...`);
    await this.checkRawMarketData(symbol);
  }

  private async checkRawMarketData(symbol: string): Promise<void> {
    try {
      const { data: marketData, error } = await supabase
        .from('market_data')
        .select('*')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) {
        console.error(`❌ Error fetching market data:`, error);
        return;
      }

      console.log(`📊 Latest 20 market data entries for ${symbol}:`);
      if (marketData && marketData.length > 0) {
        marketData.forEach((entry, i) => {
          const date = new Date(entry.timestamp).toISOString();
          console.log(`  ${i + 1}. ${date}: $${parseFloat(entry.price).toFixed(2)} (Volume: ${entry.volume || 'N/A'})`);
        });

        const prices = marketData.map(d => parseFloat(d.price.toString()));
        console.log(`\n💰 Market Data Summary:`);
        console.log(`  - Latest price: $${prices[0].toFixed(2)}`);
        console.log(`  - Lowest in last 20: $${Math.min(...prices).toFixed(2)}`);
        console.log(`  - Highest in last 20: $${Math.max(...prices).toFixed(2)}`);
      } else {
        console.log(`❌ No market data found for ${symbol}`);
      }
    } catch (error) {
      console.error(`❌ Error checking raw market data:`, error);
    }
  }
}
