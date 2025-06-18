
import { supabase } from '@/integrations/supabase/client';
import { TypeConverter } from '../TypeConverter';
import { TradingLogger } from '../TradingLogger';

export class TradeRepository {
  private logger: TradingLogger;

  constructor(userId: string) {
    this.logger = new TradingLogger(userId);
  }

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

  async updateTrade(tradeId: string, updateData: {
    price?: number;
    quantity?: number;
    status?: string;
    buy_fill_price?: number;
    profit_loss?: number;
    bybit_order_id?: string;
  }): Promise<ReturnType<typeof TypeConverter.toTradeRecord>> {
    try {
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
