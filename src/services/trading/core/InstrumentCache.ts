
import { BybitInstrumentInfo } from './InstrumentInfoFetcher';

export class InstrumentCache {
  private static instrumentCache: Map<string, BybitInstrumentInfo> = new Map();
  private static cacheExpiry: Map<string, number> = new Map();
  private static readonly CACHE_TTL_MS = 300000; // 5 minutes
  private static cleanupInterval: number | null = null;

  static {
    // Start cleanup interval when class is first loaded
    this.startCleanupInterval();
  }

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

  /**
   * Start automatic cleanup of expired cache entries
   */
  private static startCleanupInterval(): void {
    if (this.cleanupInterval !== null) return;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000) as unknown as number; // Cleanup every minute
  }

  /**
   * Clean up expired cache entries
   */
  private static cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredSymbols: string[] = [];
    
    for (const [symbol, expiry] of this.cacheExpiry.entries()) {
      if (now >= expiry) {
        expiredSymbols.push(symbol);
      }
    }
    
    for (const symbol of expiredSymbols) {
      this.instrumentCache.delete(symbol);
      this.cacheExpiry.delete(symbol);
    }
    
    if (expiredSymbols.length > 0) {
      console.log(`🧹 Cleaned up ${expiredSymbols.length} expired cache entries`);
    }
  }

  /**
   * Stop cleanup interval (for cleanup/testing)
   */
  static stopCleanupInterval(): void {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; expired: number } {
    const now = Date.now();
    let expired = 0;
    
    for (const expiry of this.cacheExpiry.values()) {
      if (now >= expiry) {
        expired++;
      }
    }
    
    return {
      size: this.instrumentCache.size,
      expired
    };
  }
}
