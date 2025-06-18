
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitInstrumentService } from './BybitInstrumentService';
import { DatabaseQueryHelper } from './DatabaseQueryHelper';
import { TypeConverter } from './TypeConverter';

export interface SignalContext {
  symbol: string;
  currentPrice: number;
  instrumentInfo: any;
  activeTrades: any[];
  existingSignals: any[];
  existingPositions: any[];
  isAveragingDown: boolean;
  maxPositionsReached: boolean;
}

export class SignalAnalysisCore {
  private userId: string;
  private dbHelper: DatabaseQueryHelper;

  constructor(userId: string) {
    this.userId = userId;
    this.dbHelper = new DatabaseQueryHelper(userId);
  }

  async getSignalContext(symbol: string, config: TradingConfigData): Promise<SignalContext | null> {
    try {
      // Get instrument info FIRST for consistent formatting
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (!instrumentInfo) {
        console.error(`❌ Could not get instrument info for ${symbol}`);
        return null;
      }

      // Use type-safe database queries
      const existingSignals = await this.dbHelper.getSignals(this.userId, {
        symbol,
        processed: false
      });

      const activeTrades = await this.dbHelper.getTrades(this.userId, {
        symbol,
        status: ['pending', 'filled', 'partial_filled']
      });

      // Filter to only buy trades for averaging down logic
      const buyTrades = activeTrades.filter(trade => trade.side === 'buy');

      const totalActiveCount = existingSignals.length + buyTrades.length;
      const maxPositionsReached = totalActiveCount >= config.max_positions_per_pair;
      
      if (maxPositionsReached) {
        console.log(`❌ ${symbol}: Max positions reached (${totalActiveCount}/${config.max_positions_per_pair})`);
        return null;
      }

      const isAveragingDown = buyTrades.length > 0;
      const existingPositions = buyTrades;

      return {
        symbol,
        currentPrice: 0, // Will be set by caller
        instrumentInfo,
        activeTrades: buyTrades,
        existingSignals,
        existingPositions,
        isAveragingDown,
        maxPositionsReached
      };
    } catch (error) {
      console.error(`❌ Error getting signal context for ${symbol}:`, error);
      return null;
    }
  }

  async storeSignal(symbol: string, action: string, entryPrice: number, confidence: number, reasoning: string): Promise<any> {
    try {
      console.log(`📝 Storing signal for ${symbol}: ${action} at ${entryPrice}`);

      const signal = await this.dbHelper.createSignal({
        user_id: this.userId,
        symbol,
        signal_type: action,
        price: entryPrice,
        confidence,
        reasoning
      });

      console.log(`✅ Signal stored successfully: ${signal.id}`);
      return signal;
    } catch (error) {
      console.error(`❌ Database error creating signal for ${symbol}:`, error);
      throw error;
    }
  }
}
