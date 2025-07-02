
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class PositionValidator {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async validatePositionLimits(symbol: string, config: TradingConfigData): Promise<boolean> {
    try {
      console.log(`🔍 CRITICAL VALIDATION: Checking position limits for ${symbol}...`);
      console.log(`📊 Config limits - Max active pairs: ${config.max_active_pairs}, Max positions per pair: ${config.max_positions_per_pair}`);

      // PHASE 1: Check max positions per pair for this specific symbol FIRST - MOST CRITICAL
      // FIXED: Only count BUY orders for position limits (sell orders are take-profit orders)
      const { count: currentPositions } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('side', 'buy') // CRITICAL FIX: Only count buy orders
        .in('status', ['pending', 'filled', 'partial_filled']);

      console.log(`📈 CRITICAL CHECK: Current BUY positions for ${symbol}: ${currentPositions || 0}/${config.max_positions_per_pair}`);

      if ((currentPositions || 0) >= config.max_positions_per_pair) {
        console.error(`❌ POSITION LIMIT EXCEEDED: Max buy positions per pair for ${symbol}: ${currentPositions}/${config.max_positions_per_pair}`);
        console.error(`🚨 BLOCKING ORDER: This would exceed the configured limit of ${config.max_positions_per_pair} buy positions for ${symbol}`);
        return false;
      }

      // PHASE 2: Check max active pairs (only count buy orders)
      const { data: activeTrades } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .eq('side', 'buy') // CRITICAL FIX: Only count buy orders for active pairs
        .in('status', ['pending', 'filled', 'partial_filled']);

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
      
      // Additional logging for debugging
      console.log(`🔍 Debug info: User ID: ${this.userId}, Symbol: ${symbol}`);
      console.log(`🔍 Query results: ${currentPositions} positions found for ${symbol}`);
      
      return true;

    } catch (error) {
      console.error(`❌ CRITICAL ERROR validating position limits for ${symbol}:`, error);
      // On error, be conservative and reject the order
      return false;
    }
  }

  async getCurrentPositionCount(symbol: string): Promise<number> {
    try {
      // FIXED: Only count buy orders for position limits
      const { count } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('side', 'buy') // CRITICAL FIX: Only count buy orders
        .in('status', ['pending', 'filled', 'partial_filled']);

      const result = count || 0;
      console.log(`📊 Current BUY position count for ${symbol}: ${result}`);
      return result;
    } catch (error) {
      console.error(`❌ Error getting position count for ${symbol}:`, error);
      return 0;
    }
  }

  async getActivePairsCount(): Promise<number> {
    try {
      // FIXED: Only count buy orders for active pairs
      const { data: activeTrades } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .eq('side', 'buy') // CRITICAL FIX: Only count buy orders
        .in('status', ['pending', 'filled', 'partial_filled']);

      const uniquePairs = new Set(activeTrades?.map(trade => trade.symbol) || []);
      const result = uniquePairs.size;
      console.log(`📊 Active pairs count (buy orders only): ${result} (${Array.from(uniquePairs).join(', ')})`);
      return result;
    } catch (error) {
      console.error('❌ Error getting active pairs count:', error);
      return 0;
    }
  }

  /**
   * NEW: Detailed validation with comprehensive logging
   */
  async validateWithDetailedLogging(symbol: string, config: TradingConfigData): Promise<{
    isValid: boolean;
    reason?: string;
    currentPositions: number;
    activePairs: number;
    limits: {
      maxPositionsPerPair: number;
      maxActivePairs: number;
    };
  }> {
    try {
      const currentPositions = await this.getCurrentPositionCount(symbol);
      const activePairs = await this.getActivePairsCount();
      
      const limits = {
        maxPositionsPerPair: config.max_positions_per_pair,
        maxActivePairs: config.max_active_pairs
      };

      console.log(`🔍 DETAILED VALIDATION for ${symbol}:`, {
        currentPositions,
        activePairs,
        limits
      });

      // Check positions per pair
      if (currentPositions >= limits.maxPositionsPerPair) {
        return {
          isValid: false,
          reason: `Max positions per pair exceeded: ${currentPositions}/${limits.maxPositionsPerPair}`,
          currentPositions,
          activePairs,
          limits
        };
      }

      // Check active pairs (only if this would be a new pair) - only count buy orders
      const { data: existingForSymbol } = await supabase
        .from('trades')
        .select('id')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('side', 'buy') // CRITICAL FIX: Only count buy orders
        .in('status', ['pending', 'filled', 'partial_filled'])
        .limit(1);

      const isNewPair = !existingForSymbol || existingForSymbol.length === 0;
      
      if (isNewPair && activePairs >= limits.maxActivePairs) {
        return {
          isValid: false,
          reason: `Max active pairs exceeded: ${activePairs}/${limits.maxActivePairs}`,
          currentPositions,
          activePairs,
          limits
        };
      }

      return {
        isValid: true,
        currentPositions,
        activePairs,
        limits
      };

    } catch (error) {
      console.error(`❌ Error in detailed validation for ${symbol}:`, error);
      return {
        isValid: false,
        reason: `Validation error: ${error.message}`,
        currentPositions: 0,
        activePairs: 0,
        limits: {
          maxPositionsPerPair: config.max_positions_per_pair,
          maxActivePairs: config.max_active_pairs
        }
      };
    }
  }
}
