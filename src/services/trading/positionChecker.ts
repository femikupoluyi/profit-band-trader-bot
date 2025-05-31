
import { supabase } from '@/integrations/supabase/client';

export class PositionChecker {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async hasOpenPosition(symbol: string): Promise<boolean> {
    try {
      const { count } = await (supabase as any)
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled']);

      return count > 0;
    } catch (error) {
      console.error(`Error checking open position for ${symbol}:`, error);
      return false;
    }
  }
}
