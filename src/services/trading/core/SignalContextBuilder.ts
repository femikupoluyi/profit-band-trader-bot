
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SignalContext } from './SignalAnalysisCore';
import { BybitInstrumentService } from './BybitInstrumentService';
import { ServiceContainer } from './ServiceContainer';

/**
 * Centralized builder for creating SignalContext objects
 */
export class SignalContextBuilder {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async buildContext(symbol: string, config: TradingConfigData): Promise<SignalContext | null> {
    try {
      console.log(`🏗️ Building signal context for ${symbol}`);

      // Get instrument info FIRST for consistent formatting
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (!instrumentInfo) {
        console.error(`❌ Could not get instrument info for ${symbol}`);
        return null;
      }

      // Use centralized database helper
      const dbHelper = ServiceContainer.getDatabaseHelper(this.userId);

      // Get existing signals
      const existingSignals = await dbHelper.getSignals(this.userId, {
        symbol,
        processed: false
      });

      // Get active trades
      const activeTrades = await dbHelper.getTrades(this.userId, {
        symbol,
        status: ['pending', 'filled', 'partial_filled']
      });

      // Filter to only buy trades for averaging down logic
      const buyTrades = activeTrades.filter(trade => trade.side === 'buy');
      const existingPositions = buyTrades;

      // Calculate totals and limits
      const totalActiveCount = existingSignals.length + buyTrades.length;
      const maxPositionsReached = totalActiveCount >= config.max_positions_per_pair;
      
      if (maxPositionsReached) {
        console.log(`❌ ${symbol}: Max positions reached (${totalActiveCount}/${config.max_positions_per_pair})`);
        return null;
      }

      const isAveragingDown = buyTrades.length > 0;

      const context: SignalContext = {
        symbol,
        currentPrice: 0, // Will be set by caller
        instrumentInfo,
        activeTrades: buyTrades,
        existingSignals,
        existingPositions,
        isAveragingDown,
        maxPositionsReached
      };

      console.log(`✅ Signal context built for ${symbol}:`, {
        existingSignals: existingSignals.length,
        activeTrades: buyTrades.length,
        isAveragingDown,
        maxPositionsReached
      });

      return context;
    } catch (error) {
      console.error(`❌ Error building signal context for ${symbol}:`, error);
      return null;
    }
  }
}
