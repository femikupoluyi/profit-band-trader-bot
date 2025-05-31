
import { supabase } from '@/integrations/supabase/client';
import { CandleData } from './types';

export class CandleDataService {
  async getCandleData(symbol: string, count: number): Promise<CandleData[]> {
    try {
      // Get recent market data as candles (simplified - in real implementation you'd get proper OHLCV data)
      const { data: marketData } = await (supabase as any)
        .from('market_data')
        .select('price, timestamp')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(count * 2); // Get more data to simulate candles

      if (!marketData || marketData.length < count) {
        return [];
      }

      // Convert price data to simplified candle data
      const candles: CandleData[] = [];
      for (let i = 0; i < Math.min(count, marketData.length - 1); i += 2) {
        const price1 = parseFloat(marketData[i].price);
        const price2 = parseFloat(marketData[i + 1]?.price || marketData[i].price);
        
        candles.push({
          timestamp: new Date(marketData[i].timestamp).getTime(),
          open: price2,
          high: Math.max(price1, price2),
          low: Math.min(price1, price2),
          close: price1,
          volume: 0 // Not available in our simplified data
        });
      }

      return candles;
    } catch (error) {
      console.error(`Error getting candle data for ${symbol}:`, error);
      return [];
    }
  }
}
