
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitInstrumentService } from './BybitInstrumentService';

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

  constructor(userId: string) {
    this.userId = userId;
  }

  async getSignalContext(symbol: string, config: TradingConfigData): Promise<SignalContext | null> {
    // Get instrument info FIRST for consistent formatting
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (!instrumentInfo) {
      console.error(`❌ Could not get instrument info for ${symbol}`);
      return null;
    }

    // Check existing signals and positions
    const { data: existingSignals } = await supabase
      .from('trading_signals')
      .select('id, signal_type, price, created_at')
      .eq('user_id', this.userId)
      .eq('symbol', symbol)
      .eq('processed', false);

    const { data: activeTrades } = await supabase
      .from('trades')
      .select('id, status, side, price, quantity, created_at')
      .eq('user_id', this.userId)
      .eq('symbol', symbol)
      .eq('side', 'buy')
      .in('status', ['pending', 'filled', 'partial_filled']);

    const totalActiveCount = (existingSignals?.length || 0) + (activeTrades?.length || 0);
    const maxPositionsReached = totalActiveCount >= config.max_positions_per_pair;
    
    if (maxPositionsReached) {
      console.log(`❌ ${symbol}: Max positions reached (${totalActiveCount}/${config.max_positions_per_pair})`);
      return null;
    }

    const isAveragingDown = activeTrades && activeTrades.length > 0;
    const existingPositions = activeTrades || [];

    return {
      symbol,
      currentPrice: 0, // Will be set by caller
      instrumentInfo,
      activeTrades: activeTrades || [],
      existingSignals: existingSignals || [],
      existingPositions,
      isAveragingDown,
      maxPositionsReached
    };
  }

  async storeSignal(symbol: string, action: string, entryPrice: number, confidence: number, reasoning: string): Promise<any> {
    const { data: signal, error } = await supabase
      .from('trading_signals')
      .insert({
        user_id: this.userId,
        symbol: symbol,
        signal_type: action,
        price: entryPrice,
        confidence: confidence,
        reasoning: reasoning,
        processed: false
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ Database error creating signal for ${symbol}:`, error);
      throw error;
    }

    return signal;
  }
}
