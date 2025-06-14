
import { BybitService } from '../../bybitService';
import { supabase } from '@/integrations/supabase/client';

export class TrendAnalysisService {
  private bybitService: BybitService;

  constructor(bybitService: BybitService) {
    this.bybitService = bybitService;
  }

  async getTrend(symbol: string, timeframe: string = '4h'): Promise<string> {
    try {
      console.log(`📈 Getting trend for ${symbol} on ${timeframe} timeframe`);

      // Get recent market data for trend analysis
      const now = Date.now();
      const hoursBack = 24; // Look back 24 hours
      const startTime = new Date(now - (hoursBack * 60 * 60 * 1000)).toISOString();

      const { data, error } = await supabase
        .from('market_data')
        .select('price, timestamp')
        .eq('symbol', symbol)
        .gte('timestamp', startTime)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error(`❌ Error fetching trend data for ${symbol}:`, error);
        return 'neutral';
      }

      if (!data || data.length < 5) {
        console.warn(`⚠️ Insufficient data for trend analysis of ${symbol}`);
        return 'neutral';
      }

      // Simple trend analysis: compare first and last prices
      const firstPrice = data[0].price;
      const lastPrice = data[data.length - 1].price;
      const priceChange = (lastPrice - firstPrice) / firstPrice;

      if (priceChange > 0.02) { // 2% increase
        return 'bullish';
      } else if (priceChange < -0.02) { // 2% decrease
        return 'bearish';
      } else {
        return 'neutral';
      }

    } catch (error) {
      console.error(`❌ Error in trend analysis for ${symbol}:`, error);
      return 'neutral';
    }
  }
}
