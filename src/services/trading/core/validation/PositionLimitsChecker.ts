import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class PositionLimitsChecker {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async validatePositionLimits(symbol: string, config: TradingConfigData): Promise<boolean> {
    try {
      console.log(`🔍 CRITICAL VALIDATION: Checking position limits for ${symbol}...`);
      console.log(`📊 Config limits - Max active pairs: ${config.max_active_pairs}, Max positions per pair: ${config.max_positions_per_pair}`);

      // PHASE 1: Check max positions per pair for this specific symbol FIRST - MOST CRITICAL
      // FIXED: Only count FILLED orders, not pending ones for position limits
      const { data: existingTrades, error } = await supabase
        .from('trades')
        .select('id, status, created_at')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('side', 'buy')
        .in('status', ['filled', 'partial_filled']) // CRITICAL FIX: Only count filled orders for position limits
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`❌ Database error checking positions for ${symbol}:`, error);
        return false; // Fail safe - block if we can't verify
      }

      const currentPositions = existingTrades?.length || 0;
      console.log(`📈 REAL-TIME CHECK: Current FILLED BUY positions for ${symbol}: ${currentPositions}/${config.max_positions_per_pair}`);
      
      // List existing trades for debugging
      if (existingTrades && existingTrades.length > 0) {
        console.log(`📋 Existing filled trades for ${symbol}:`, existingTrades.map(t => `${t.id.slice(0,8)}(${t.status})`).join(', '));
      }

      if (currentPositions >= config.max_positions_per_pair) {
        console.error(`❌ POSITION LIMIT EXCEEDED: Max filled buy positions per pair for ${symbol}: ${currentPositions}/${config.max_positions_per_pair}`);
        console.error(`🚨 BLOCKING ORDER: This would exceed the configured limit of ${config.max_positions_per_pair} filled buy positions for ${symbol}`);
        return false;
      }

      // PHASE 2: Check max active pairs (only count filled buy orders)
      const { data: activeTrades } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .eq('side', 'buy')
        .in('status', ['filled', 'partial_filled']); // CRITICAL FIX: Only count filled orders for active pairs

      const uniquePairs = new Set(activeTrades?.map(trade => trade.symbol) || []);
      const activePairCount = uniquePairs.size;
      
      console.log(`📊 Active pairs analysis: ${activePairCount}/${config.max_active_pairs}`);
      console.log(`📋 Current active pairs: ${Array.from(uniquePairs).join(', ')}`);

      // If this symbol is new and we're at max pairs, reject
      if (!uniquePairs.has(symbol) && activePairCount >= config.max_active_pairs) {
        console.error(`❌ ACTIVE PAIRS LIMIT EXCEEDED: Max active pairs limit: ${activePairCount}/${config.max_active_pairs}`);
        console.error(`🚨 BLOCKING ORDER: Adding ${symbol} would exceed the configured limit of ${config.max_active_pairs} active pairs`);
        return false;
      }

      console.log(`✅ POSITION LIMITS CHECK PASSED for ${symbol}: ${currentPositions}/${config.max_positions_per_pair} positions, ${activePairCount}/${config.max_active_pairs} pairs`);
      
      return true;

    } catch (error) {
      console.error(`❌ CRITICAL ERROR validating position limits for ${symbol}:`, error);
      return false;
    }
  }
}