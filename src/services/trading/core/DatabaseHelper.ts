
import { supabase } from '@/integrations/supabase/client';

export class DatabaseHelper {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async getSignals(userId: string, options: { limit?: number; symbol?: string; processed?: boolean } = {}): Promise<any[]> {
    try {
      let query = supabase
        .from('trading_signals')
        .select('*')
        .eq('user_id', userId);

      if (options.symbol) {
        query = query.eq('symbol', options.symbol);
      }

      if (options.processed !== undefined) {
        query = query.eq('processed', options.processed);
      }

      query = query.order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(options.limit);
      } else {
        query = query.limit(50);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching signals:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching signals:', error);
      return [];
    }
  }

  async getTrades(userId: string, options: { limit?: number; symbol?: string; status?: string[] } = {}): Promise<any[]> {
    try {
      let query = supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId);

      if (options.symbol) {
        query = query.eq('symbol', options.symbol);
      }

      if (options.status) {
        query = query.in('status', options.status);
      }

      query = query.order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(options.limit);
      } else {
        query = query.limit(50);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching trades:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching trades:', error);
      return [];
    }
  }

  async getMarketData(symbol: string, limit: number = 100): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('market_data')
        .select('*')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching market data:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching market data:', error);
      return [];
    }
  }

  async createSignal(signalData: {
    user_id: string;
    symbol: string;
    signal_type: string;
    price: number;
    confidence?: number;
    reasoning?: string;
  }): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('trading_signals')
        .insert({
          user_id: signalData.user_id,
          symbol: signalData.symbol,
          signal_type: signalData.signal_type,
          price: signalData.price,
          confidence: signalData.confidence,
          reasoning: signalData.reasoning,
          processed: false
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating signal:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating signal:', error);
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
  }): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('trades')
        .insert({
          user_id: tradeData.user_id,
          symbol: tradeData.symbol,
          side: tradeData.side,
          price: tradeData.price,
          quantity: tradeData.quantity,
          order_type: tradeData.order_type,
          status: tradeData.status,
          bybit_order_id: tradeData.bybit_order_id
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating trade:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating trade:', error);
      throw error;
    }
  }
}
