
import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './TradingLogger';

export class PositionCleanupService {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  async cleanupExcessivePositions(symbol: string, maxAllowed: number): Promise<void> {
    try {
      console.log(`🧹 Cleaning up excessive positions for ${symbol} (max allowed: ${maxAllowed})`);
      
      // Get all positions for this symbol
      const { data: positions, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled', 'partial_filled'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error(`❌ Error fetching positions for ${symbol}:`, error);
        return;
      }

      const currentCount = positions?.length || 0;
      console.log(`📊 Found ${currentCount} active positions for ${symbol}`);

      if (currentCount <= maxAllowed) {
        console.log(`✅ Position count is within limits for ${symbol}`);
        return;
      }

      // Mark excess positions as closed
      const excessCount = currentCount - maxAllowed;
      const positionsToClose = positions.slice(0, excessCount);
      
      console.log(`🔄 Closing ${excessCount} excess positions for ${symbol}`);

      for (const position of positionsToClose) {
        const { error: updateError } = await supabase
          .from('trades')
          .update({
            status: 'closed',
            updated_at: new Date().toISOString()
          })
          .eq('id', position.id);

        if (updateError) {
          console.error(`❌ Error closing position ${position.id}:`, updateError);
        } else {
          console.log(`✅ Closed excess position ${position.id} for ${symbol}`);
        }
      }

      await this.logger.logSystemInfo(`Cleaned up excessive positions for ${symbol}`, {
        symbol,
        originalCount: currentCount,
        maxAllowed,
        closedCount: excessCount
      });

    } catch (error) {
      console.error(`❌ Error in position cleanup for ${symbol}:`, error);
      await this.logger.logError(`Position cleanup failed for ${symbol}`, error);
    }
  }

  async cleanupAllExcessivePositions(maxPositionsPerPair: number): Promise<void> {
    try {
      console.log(`🧹 Starting comprehensive position cleanup (max per pair: ${maxPositionsPerPair})`);
      
      // Get all symbols with active positions
      const { data: symbolData, error } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled', 'partial_filled']);

      if (error) {
        console.error('❌ Error fetching symbols with positions:', error);
        return;
      }

      const uniqueSymbols = [...new Set(symbolData?.map(t => t.symbol) || [])];
      console.log(`📊 Found positions in ${uniqueSymbols.length} symbols:`, uniqueSymbols);

      // Cleanup each symbol
      for (const symbol of uniqueSymbols) {
        await this.cleanupExcessivePositions(symbol, maxPositionsPerPair);
      }

      console.log(`✅ Comprehensive position cleanup complete`);
      
    } catch (error) {
      console.error('❌ Error in comprehensive position cleanup:', error);
      await this.logger.logError('Comprehensive position cleanup failed', error);
    }
  }

  async auditPositions(): Promise<{
    totalPositions: number;
    positionsBySymbol: Record<string, number>;
    excessivePositions: string[];
    maxAllowed: number;
  }> {
    try {
      const { data: positions, error } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled', 'partial_filled']);

      if (error) {
        console.error('❌ Error auditing positions:', error);
        return { totalPositions: 0, positionsBySymbol: {}, excessivePositions: [], maxAllowed: 2 };
      }

      const positionsBySymbol: Record<string, number> = {};
      const maxAllowed = 2; // Default from config

      positions?.forEach(pos => {
        positionsBySymbol[pos.symbol] = (positionsBySymbol[pos.symbol] || 0) + 1;
      });

      const excessivePositions = Object.entries(positionsBySymbol)
        .filter(([_, count]) => count > maxAllowed)
        .map(([symbol, _]) => symbol);

      const totalPositions = positions?.length || 0;

      console.log(`📊 Position Audit:`, {
        totalPositions,
        positionsBySymbol,
        excessivePositions,
        maxAllowed
      });

      return {
        totalPositions,
        positionsBySymbol,
        excessivePositions,
        maxAllowed
      };

    } catch (error) {
      console.error('❌ Error in position audit:', error);
      return { totalPositions: 0, positionsBySymbol: {}, excessivePositions: [], maxAllowed: 2 };
    }
  }
}
