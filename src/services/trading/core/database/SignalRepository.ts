
import { supabase } from '@/integrations/supabase/client';
import { TypeConverter } from '../TypeConverter';
import { TradingLogger } from '../TradingLogger';

export class SignalRepository {
  private logger: TradingLogger;

  constructor(userId: string) {
    this.logger = new TradingLogger(userId);
  }

  async getSignals(userId: string, filters?: {
    symbol?: string;
    processed?: boolean;
    limit?: number;
  }): Promise<ReturnType<typeof TypeConverter.toSignalRecord>[]> {
    try {
      let query = supabase
        .from('trading_signals')
        .select('*')
        .eq('user_id', userId);

      if (filters?.symbol) {
        query = query.eq('symbol', filters.symbol);
      }

      if (filters?.processed !== undefined) {
        query = query.eq('processed', filters.processed);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        await this.logger.logError('Database query error for signals', error);
        throw error;
      }

      return (data || []).map(record => TypeConverter.toSignalRecord(record));
    } catch (error) {
      await this.logger.logError('Failed to get signals', error, { userId, filters });
      throw error;
    }
  }

  async createSignal(signalData: {
    user_id: string;
    symbol: string;
    signal_type: string;
    price: number;
    confidence?: number;
    reasoning?: string;
  }): Promise<ReturnType<typeof TypeConverter.toSignalRecord>> {
    try {
      const validatedData = {
        user_id: signalData.user_id,
        symbol: signalData.symbol,
        signal_type: signalData.signal_type,
        price: TypeConverter.toPrice(signalData.price),
        confidence: signalData.confidence ? TypeConverter.toNumber(signalData.confidence, 'confidence') : undefined,
        reasoning: signalData.reasoning,
        processed: false
      };

      const { data, error } = await supabase
        .from('trading_signals')
        .insert(validatedData)
        .select()
        .single();

      if (error) {
        await this.logger.logError('Database insert error for signal', error);
        throw error;
      }

      return TypeConverter.toSignalRecord(data);
    } catch (error) {
      await this.logger.logError('Failed to create signal', error, { signalData });
      throw error;
    }
  }
}
