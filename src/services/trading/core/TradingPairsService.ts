
import { BybitService } from '@/services/bybitService';
import { ConfigurableFormatter } from './ConfigurableFormatter';

export class TradingPairsService {
  private static cachedTradingPairs: string[] = [];
  private static lastFetchTime: number = 0;
  private static readonly CACHE_TTL_MS = 3600000; // 1 hour

  /**
   * Fetch active trading pairs from the exchange
   */
  static async fetchActiveTradingPairs(bybitService: BybitService): Promise<string[]> {
    try {
      // Use cached data if it's still fresh
      const now = Date.now();
      if (this.cachedTradingPairs.length > 0 && 
          (now - this.lastFetchTime) < this.CACHE_TTL_MS) {
        return this.cachedTradingPairs;
      }

      console.log('Fetching active trading pairs from Bybit...');
      
      // This is a placeholder - in a real implementation, we would call
      // an API method on bybitService to get the active symbols
      // For now, we'll use a hard-coded list that can be updated later
      const supportedPairs = [
        'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 
        'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'MATICUSDT', 'FETUSDT', 
        'POLUSDT', 'XLMUSDT', 'AVAXUSDT', 'DOTUSDT', 'SHIBUSDT'
      ];

      // Update the cache
      this.cachedTradingPairs = supportedPairs;
      this.lastFetchTime = now;
      
      // Also update the ConfigurableFormatter
      ConfigurableFormatter.setActivePairs(supportedPairs);
      
      return supportedPairs;
    } catch (error) {
      console.error('Failed to fetch active trading pairs:', error);
      
      // Return a default list if the fetch fails
      const defaultPairs = [
        'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT'
      ];
      
      return defaultPairs;
    }
  }

  /**
   * Get the current list of active trading pairs
   */
  static getCurrentPairs(): string[] {
    return this.cachedTradingPairs.length > 0 
      ? this.cachedTradingPairs 
      : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT'];
  }

  /**
   * Check if a trading pair is supported
   */
  static isPairSupported(symbol: string): boolean {
    return this.getCurrentPairs().includes(symbol);
  }
}
