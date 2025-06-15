
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class PositionValidator {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async validatePositionLimits(symbol: string, config: TradingConfigData): Promise<boolean> {
    try {
      console.log(`🔍 Validating position limits for ${symbol}...`);
      console.log(`📊 Config limits - Max active pairs: ${config.max_active_pairs}, Max positions per pair: ${config.max_positions_per_pair}`);

      // Check max positions per pair for this specific symbol FIRST
      const { count: currentPositions } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled', 'partial_filled']);

      console.log(`📈 Current positions for ${symbol}: ${currentPositions || 0}/${config.max_positions_per_pair}`);

      if ((currentPositions || 0) >= config.max_positions_per_pair) {
        console.log(`❌ LIMIT EXCEEDED: Max positions per pair for ${symbol}: ${currentPositions}/${config.max_positions_per_pair}`);
        return false;
      }

      // Check max active pairs
      const { data: activeTrades } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled', 'partial_filled']);

      const uniquePairs = new Set(activeTrades?.map(trade => trade.symbol) || []);
      const activePairCount = uniquePairs.size;
      
      console.log(`📊 Active pairs: ${activePairCount}/${config.max_active_pairs}, Current pairs: ${Array.from(uniquePairs).join(', ')}`);

      // If this symbol is new and we're at max pairs, reject
      if (!uniquePairs.has(symbol) && activePairCount >= config.max_active_pairs) {
        console.log(`❌ LIMIT EXCEEDED: Max active pairs limit: ${activePairCount}/${config.max_active_pairs}`);
        return false;
      }

      console.log(`✅ Position limits check PASSED for ${symbol}: ${currentPositions}/${config.max_positions_per_pair} positions, ${activePairCount}/${config.max_active_pairs} pairs`);
      return true;

    } catch (error) {
      console.error(`❌ Error validating position limits for ${symbol}:`, error);
      return false;
    }
  }

  async getCurrentPositionCount(symbol: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled', 'partial_filled']);

      return count || 0;
    } catch (error) {
      console.error(`❌ Error getting position count for ${symbol}:`, error);
      return 0;
    }
  }

  async getActivePairsCount(): Promise<number> {
    try {
      const { data: activeTrades } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled', 'partial_filled']);

      const uniquePairs = new Set(activeTrades?.map(trade => trade.symbol) || []);
      return uniquePairs.size;
    } catch (error) {
      console.error('❌ Error getting active pairs count:', error);
      return 0;
    }
  }
}
