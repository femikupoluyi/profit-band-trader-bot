
import { BybitInstrumentInfo } from './InstrumentInfoFetcher';

export class InstrumentCache {
  private static instrumentCache: Map<string, BybitInstrumentInfo> = new Map();
  private static cacheExpiry: Map<string, number> = new Map();
  private static readonly CACHE_TTL_MS = 300000; // 5 minutes

  static getCachedInstrument(symbol: string): BybitInstrumentInfo | null {
    const cached = this.instrumentCache.get(symbol);
    const expiry = this.cacheExpiry.get(symbol);
    
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }
    
    // Remove expired cache
    this.instrumentCache.delete(symbol);
    this.cacheExpiry.delete(symbol);
    return null;
  }

  static cacheInstrument(symbol: string, info: BybitInstrumentInfo): void {
    this.instrumentCache.set(symbol, info);
    this.cacheExpiry.set(symbol, Date.now() + this.CACHE_TTL_MS);
  }

  /**
   * Clear all cached instrument data
   */
  static clearCache(): void {
    this.instrumentCache.clear();
    this.cacheExpiry.clear();
    console.log('🗑️ Instrument cache cleared');
  }
}
