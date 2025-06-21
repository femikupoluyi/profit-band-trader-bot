
import { supabase } from '@/integrations/supabase/client';

export class DatabaseHelper {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async getSignals(userId: string, options: { limit?: number } = {}): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('trading_signals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(options.limit || 50);

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

  async getTrades(userId: string, options: { limit?: number } = {}): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(options.limit || 50);

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
}
