
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class PositionValidator {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async validatePositionLimits(symbol: string, config: TradingConfigData): Promise<boolean> {
    try {
      // Check max active pairs
      const { data: activePairs } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled', 'partial_filled']);

      const uniquePairs = new Set(activePairs?.map(trade => trade.symbol) || []);
      const activePairCount = uniquePairs.size;
      
      // If this symbol is new and we're at max pairs, reject
      if (!uniquePairs.has(symbol) && activePairCount >= config.max_active_pairs) {
        console.log(`❌ Max active pairs limit reached: ${activePairCount}/${config.max_active_pairs}`);
        return false;
      }

      // Check max positions per pair for this specific symbol
      const { count: currentPositions } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled', 'partial_filled']);

      if ((currentPositions || 0) >= config.max_positions_per_pair) {
        console.log(`❌ Max positions per pair exceeded for ${symbol}: ${currentPositions}/${config.max_positions_per_pair}`);
        return false;
      }

      console.log(`✅ Position limits check passed for ${symbol}: ${currentPositions}/${config.max_positions_per_pair} positions, ${activePairCount}/${config.max_active_pairs} pairs`);
      return true;

    } catch (error) {
      console.error('Error validating position limits:', error);
      return false;
    }
  }
}
