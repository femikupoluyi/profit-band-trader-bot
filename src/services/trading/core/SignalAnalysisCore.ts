
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SignalContextBuilder } from './SignalContextBuilder';
import { ServiceContainer } from './ServiceContainer';

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
  private contextBuilder: SignalContextBuilder;

  constructor(userId: string) {
    this.userId = userId;
    this.contextBuilder = new SignalContextBuilder(userId);
  }

  async getSignalContext(symbol: string, config: TradingConfigData): Promise<SignalContext | null> {
    return this.contextBuilder.buildContext(symbol, config);
  }

  async storeSignal(symbol: string, action: string, entryPrice: number, confidence: number, reasoning: string): Promise<any> {
    try {
      console.log(`📝 Storing signal for ${symbol}: ${action} at ${entryPrice}`);

      const dbHelper = ServiceContainer.getDatabaseHelper(this.userId);
      const signal = await dbHelper.createSignal({
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
