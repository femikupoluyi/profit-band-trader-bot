
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
      const { data } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled']);

      const uniquePairs = new Set(data?.map(trade => trade.symbol) || []);
      const activePairs = uniquePairs.size;
      const canOpen = activePairs < maxPairs;
      console.log(`Active pairs validation: ${activePairs}/${maxPairs} - Can open new: ${canOpen}`);
      return canOpen;
    } catch (error) {
      console.error('Error validating max active pairs:', error);
      return false;
    }
  }

  async validateMaxPositionsPerPair(symbol: string, maxPositionsPerPair: number): Promise<boolean> {
    try {
      const { count } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled']);

      const currentPositions = count || 0;
      const canOpenNew = currentPositions < maxPositionsPerPair;
      console.log(`Positions per pair validation for ${symbol}: ${currentPositions}/${maxPositionsPerPair} - Can open new: ${canOpenNew}`);
      return canOpenNew;
    } catch (error) {
      console.error(`Error validating max positions per pair for ${symbol}:`, error);
      return false;
    }
  }

  async getLowestEntryPrice(symbol: string): Promise<number | null> {
    try {
      const { data } = await supabase
        .from('trades')
        .select('price')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled'])
        .order('price', { ascending: true })
        .limit(1);

      if (data && data.length > 0) {
        const lowestPrice = parseFloat(data[0].price.toString());
        console.log(`Lowest entry price for ${symbol}: $${lowestPrice}`);
        return lowestPrice;
      }
      return null;
    } catch (error) {
      console.error(`Error getting lowest entry price for ${symbol}:`, error);
      return null;
    }
  }

  async canOpenNewPositionWithLowerSupport(
    symbol: string, 
    newSupportPrice: number, 
    newSupportThresholdPercent: number,
    maxPositionsPerPair: number
  ): Promise<boolean> {
    try {
      // First check if we're under the max positions per pair
      const underMaxPositions = await this.validateMaxPositionsPerPair(symbol, maxPositionsPerPair);
      if (!underMaxPositions) {
        console.log(`Cannot open new position for ${symbol}: already at max positions per pair (${maxPositionsPerPair})`);
        return false;
      }

      // Get the lowest entry price of existing positions
      const lowestEntryPrice = await this.getLowestEntryPrice(symbol);
      if (!lowestEntryPrice) {
        console.log(`No existing positions for ${symbol}, can open new position`);
        return true;
      }

      // Calculate if the new support is significantly lower
      const priceDrop = ((lowestEntryPrice - newSupportPrice) / lowestEntryPrice) * 100;
      const canOpen = priceDrop >= newSupportThresholdPercent;
      
      console.log(`New support analysis for ${symbol}:`);
      console.log(`  Lowest entry: $${lowestEntryPrice}`);
      console.log(`  New support: $${newSupportPrice}`);
      console.log(`  Price drop: ${priceDrop.toFixed(2)}%`);
      console.log(`  Required threshold: ${newSupportThresholdPercent}%`);
      console.log(`  Can open new position: ${canOpen}`);
      
      return canOpen;
    } catch (error) {
      console.error(`Error checking new position eligibility for ${symbol}:`, error);
      return false;
    }
  }
}
