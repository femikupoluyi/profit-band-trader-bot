
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './core/TradingLogger';

export class PositionChecker {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  async canOpenNewPosition(symbol: string, config: TradingConfigData): Promise<boolean> {
    try {
      // Check maximum active pairs
      const { data: activeTrades } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled', 'partial_filled']);

      const uniqueSymbols = new Set(activeTrades?.map(trade => trade.symbol) || []);
      
      // If this is a new symbol and we're at max pairs, reject
      if (!uniqueSymbols.has(symbol) && uniqueSymbols.size >= config.max_active_pairs) {
        console.log(`❌ Max active pairs limit reached: ${uniqueSymbols.size}/${config.max_active_pairs}`);
        await this.logger.logSystemInfo(`Max active pairs limit reached for ${symbol}`, {
          currentPairs: uniqueSymbols.size,
          maxPairs: config.max_active_pairs
        });
        return false;
      }

      // Check maximum positions per symbol
      const { count: currentPositions } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled', 'partial_filled']);

      if ((currentPositions || 0) >= config.max_positions_per_pair) {
        console.log(`❌ Max positions per pair exceeded for ${symbol}: ${currentPositions}/${config.max_positions_per_pair}`);
        await this.logger.logSystemInfo(`Max positions per pair exceeded for ${symbol}`, {
          currentPositions,
          maxPositions: config.max_positions_per_pair
        });
        return false;
      }

      console.log(`✅ Position limits check passed for ${symbol}`);
      return true;

    } catch (error) {
      console.error('Error checking position limits:', error);
      await this.logger.logError('Error checking position limits', error, { symbol });
      return false;
    }
  }

  async getActivePositionsCount(): Promise<number> {
    try {
      const { count } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled', 'partial_filled']);

      return count || 0;
    } catch (error) {
      console.error('Error getting active positions count:', error);
      await this.logger.logError('Error getting active positions count', error);
      return 0;
    }
  }

  async getSymbolPositionsCount(symbol: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled', 'partial_filled']);

      return count || 0;
    } catch (error) {
      console.error(`Error getting positions count for ${symbol}:`, error);
      await this.logger.logError(`Error getting positions count for ${symbol}`, error, { symbol });
      return 0;
    }
  }
}
