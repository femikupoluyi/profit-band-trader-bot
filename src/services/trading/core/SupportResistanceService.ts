
import { BybitService } from '../../bybitService';
import { supabase } from '@/integrations/supabase/client';

export class SupportResistanceService {
  private bybitService: BybitService;

  constructor(bybitService: BybitService) {
    this.bybitService = bybitService;
  }

  async getSupportResistanceLevels(
    symbol: string,
    timeframe: string = '4h',
    candleCount: number = 128,
    lowerBoundPercent: number = 5.0,
    upperBoundPercent: number = 2.0
  ): Promise<{
    currentSupport: { price: number; volume: number } | null;
    lowerBound: number;
    upperBound: number;
  }> {
    try {
      console.log(`🔑 Getting support/resistance levels for ${symbol}`);

      // Get market data for analysis
      const now = Date.now();
      const fiveMinutesInMillis = 5 * 60 * 1000;
      const startTime = new Date(now - (candleCount * fiveMinutesInMillis)).toISOString();

      const { data, error } = await supabase
        .from('market_data')
        .select('price, volume, timestamp')
        .eq('symbol', symbol)
        .gte('timestamp', startTime)
        .order('timestamp', { ascending: false })
        .limit(candleCount);

      if (error) {
        console.error(`❌ Error fetching support/resistance data for ${symbol}:`, error);
        return {
          currentSupport: null,
          lowerBound: 0,
          upperBound: 0
        };
      }

      if (!data || data.length < 10) {
        console.warn(`⚠️ Insufficient data for support/resistance analysis of ${symbol}`);
        return {
          currentSupport: null,
          lowerBound: 0,
          upperBound: 0
        };
      }

      // Find support level (recent low with high volume)
      const prices = data.map(d => d.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const currentPrice = data[0].price;

      // Find the lowest price point with decent volume
      const supportCandidate = data
        .filter(d => d.price <= minPrice * 1.05) // Within 5% of minimum
        .sort((a, b) => b.volume - a.volume)[0]; // Highest volume

      const currentSupport = supportCandidate ? {
        price: supportCandidate.price,
        volume: supportCandidate.volume
      } : {
        price: minPrice,
        volume: 0
      };

      // Calculate bounds
      const lowerBound = currentSupport.price * (1 - lowerBoundPercent / 100);
      const upperBound = currentSupport.price * (1 + upperBoundPercent / 100);

      console.log(`🔑 Support analysis for ${symbol}:`);
      console.log(`🔑 Support Price: ${currentSupport.price}`);
      console.log(`🔑 Lower Bound: ${lowerBound}`);
      console.log(`🔑 Upper Bound: ${upperBound}`);

      return {
        currentSupport,
        lowerBound,
        upperBound
      };

    } catch (error) {
      console.error(`❌ Error in support/resistance analysis for ${symbol}:`, error);
      return {
        currentSupport: null,
        lowerBound: 0,
        upperBound: 0
      };
    }
  }
}
