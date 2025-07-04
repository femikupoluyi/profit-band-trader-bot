import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { PositionCounters } from './PositionCounters';

export interface DetailedValidationResult {
  isValid: boolean;
  reason?: string;
  currentPositions: number;
  activePairs: number;
  limits: {
    maxPositionsPerPair: number;
    maxActivePairs: number;
  };
}

export class DetailedPositionValidator {
  private userId: string;
  private counters: PositionCounters;

  constructor(userId: string) {
    this.userId = userId;
    this.counters = new PositionCounters(userId);
  }

  async validateWithDetailedLogging(symbol: string, config: TradingConfigData): Promise<DetailedValidationResult> {
    try {
      const currentPositions = await this.counters.getCurrentPositionCount(symbol);
      const activePairs = await this.counters.getActivePairsCount();
      
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

      // Check active pairs (only if this would be a new pair) - only count filled buy orders
      const { data: existingForSymbol } = await supabase
        .from('trades')
        .select('id')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('side', 'buy')
        .in('status', ['filled', 'partial_filled']) // CRITICAL FIX: Only count filled orders
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