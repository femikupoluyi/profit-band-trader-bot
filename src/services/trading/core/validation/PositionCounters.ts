import { supabase } from '@/integrations/supabase/client';

export class PositionCounters {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async getCurrentPositionCount(symbol: string): Promise<number> {
    try {
      // FIXED: Only count filled buy orders for position limits
      const { count } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('side', 'buy')
        .in('status', ['filled', 'partial_filled']); // CRITICAL FIX: Only count filled orders

      const result = count || 0;
      console.log(`📊 Current FILLED BUY position count for ${symbol}: ${result}`);
      return result;
    } catch (error) {
      console.error(`❌ Error getting position count for ${symbol}:`, error);
      return 0;
    }
  }

  async getActivePairsCount(): Promise<number> {
    try {
      // FIXED: Only count filled buy orders for active pairs
      const { data: activeTrades } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .eq('side', 'buy')
        .in('status', ['filled', 'partial_filled']); // CRITICAL FIX: Only count filled orders

      const uniquePairs = new Set(activeTrades?.map(trade => trade.symbol) || []);
      const result = uniquePairs.size;
      console.log(`📊 Active pairs count (filled buy orders only): ${result} (${Array.from(uniquePairs).join(', ')})`);
      return result;
    } catch (error) {
      console.error('❌ Error getting active pairs count:', error);
      return 0;
    }
  }
}