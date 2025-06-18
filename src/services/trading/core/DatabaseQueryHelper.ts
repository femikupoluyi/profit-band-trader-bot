
import { supabase } from '@/integrations/supabase/client';
import { TypeConverter } from './TypeConverter';
import { TradingLogger } from './TradingLogger';

export class DatabaseQueryHelper {
  private logger: TradingLogger;

  constructor(userId: string) {
    this.logger = new TradingLogger(userId);
  }

  /**
   * Get trades with proper type conversion
   */
  async getTrades(userId: string, filters?: {
    symbol?: string;
    status?: string[];
    limit?: number;
  }): Promise<ReturnType<typeof TypeConverter.toTradeRecord>[]> {
    try {
      let query = supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId);

      if (filters?.symbol) {
        query = query.eq('symbol', filters.symbol);
      }

      if (filters?.status) {
        query = query.in('status', filters.status);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        await this.logger.logError('Database query error for trades', error);
        throw error;
      }

      return (data || []).map(record => TypeConverter.toTradeRecord(record));
    } catch (error) {
      await this.logger.logError('Failed to get trades', error, { userId, filters });
      throw error;
    }
  }

  /**
   * Get signals with proper type conversion
   */
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

  /**
   * Create trade with proper type validation
   */
  async createTrade(tradeData: {
    user_id: string;
    symbol: string;
    side: 'buy' | 'sell';
    price: number;
    quantity: number;
    order_type: 'market' | 'limit';
    status: string;
    bybit_order_id?: string;
  }): Promise<ReturnType<typeof TypeConverter.toTradeRecord>> {
    try {
      // Validate types before insertion
      const validatedData = {
        user_id: tradeData.user_id,
        symbol: tradeData.symbol,
        side: tradeData.side,
        price: TypeConverter.toPrice(tradeData.price),
        quantity: TypeConverter.toQuantity(tradeData.quantity),
        order_type: tradeData.order_type,
        status: tradeData.status,
        bybit_order_id: tradeData.bybit_order_id
      };

      const { data, error } = await supabase
        .from('trades')
        .insert(validatedData)
        .select()
        .single();

      if (error) {
        await this.logger.logError('Database insert error for trade', error);
        throw error;
      }

      return TypeConverter.toTradeRecord(data);
    } catch (error) {
      await this.logger.logError('Failed to create trade', error, { tradeData });
      throw error;
    }
  }

  /**
   * Create signal with proper type validation
   */
  async createSignal(signalData: {
    user_id: string;
    symbol: string;
    signal_type: string;
    price: number;
    confidence?: number;
    reasoning?: string;
  }): Promise<ReturnType<typeof TypeConverter.toSignalRecord>> {
    try {
      // Validate types before insertion
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

  /**
   * Update trade with type validation
   */
  async updateTrade(tradeId: string, updateData: {
    price?: number;
    quantity?: number;
    status?: string;
    buy_fill_price?: number;
    profit_loss?: number;
    bybit_order_id?: string;
  }): Promise<ReturnType<typeof TypeConverter.toTradeRecord>> {
    try {
      // Validate numeric types if provided
      const validatedData: any = {};
      
      if (updateData.price !== undefined) {
        validatedData.price = TypeConverter.toPrice(updateData.price);
      }
      
      if (updateData.quantity !== undefined) {
        validatedData.quantity = TypeConverter.toQuantity(updateData.quantity);
      }
      
      if (updateData.buy_fill_price !== undefined) {
        validatedData.buy_fill_price = TypeConverter.toPrice(updateData.buy_fill_price, 'buy_fill_price');
      }
      
      if (updateData.profit_loss !== undefined) {
        validatedData.profit_loss = TypeConverter.toNumber(updateData.profit_loss, 'profit_loss');
      }
      
      if (updateData.status) {
        validatedData.status = updateData.status;
      }
      
      if (updateData.bybit_order_id) {
        validatedData.bybit_order_id = updateData.bybit_order_id;
      }

      validatedData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('trades')
        .update(validatedData)
        .eq('id', tradeId)
        .select()
        .single();

      if (error) {
        await this.logger.logError('Database update error for trade', error);
        throw error;
      }

      return TypeConverter.toTradeRecord(data);
    } catch (error) {
      await this.logger.logError('Failed to update trade', error, { tradeId, updateData });
      throw error;
    }
  }
}
