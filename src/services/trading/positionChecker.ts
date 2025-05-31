
import { supabase } from '@/integrations/supabase/client';

export class PositionChecker {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async hasOpenPosition(symbol: string): Promise<boolean> {
    try {
      const { count } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled']);

      const hasPosition = count > 0;
      console.log(`Position check for ${symbol}: ${hasPosition ? 'OPEN' : 'NONE'} (${count} positions)`);
      return hasPosition;
    } catch (error) {
      console.error(`Error checking open position for ${symbol}:`, error);
      return false;
    }
  }

  async validateMaxActivePairs(maxPairs: number): Promise<boolean> {
    try {
      const { count } = await supabase
        .from('trades')
        .select('symbol', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled']);

      const activePairs = count || 0;
      const canOpen = activePairs < maxPairs;
      console.log(`Active pairs validation: ${activePairs}/${maxPairs} - Can open new: ${canOpen}`);
      return canOpen;
    } catch (error) {
      console.error('Error validating max active pairs:', error);
      return false;
    }
  }
}
