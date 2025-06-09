
import { BybitInstrumentInfo } from './InstrumentInfoFetcher';

export class InstrumentCache {
  private static cache: Map<string, { info: BybitInstrumentInfo; timestamp: number }> = new Map();
  private static readonly CACHE_TTL_MS = 3600000; // 1 hour
  private static readonly MAX_CACHE_SIZE = 500; // Prevent memory leaks

  /**
   * Get cached instrument info if available and not expired
   */
  static getCachedInstrument(symbol: string): BybitInstrumentInfo | null {
    try {
      if (!symbol || typeof symbol !== 'string') {
        return null;
      }

      const cached = this.cache.get(symbol);
      if (!cached) {
        return null;
      }

      const now = Date.now();
      if (now - cached.timestamp > this.CACHE_TTL_MS) {
        this.cache.delete(symbol);
        return null;
      }

      return cached.info;
    } catch (error) {
      console.error(`Error retrieving cached instrument for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Cache instrument info with timestamp
   */
  static cacheInstrument(symbol: string, info: BybitInstrumentInfo): void {
    try {
      if (!symbol || !info || typeof symbol !== 'string') {
        console.warn('Invalid parameters for cacheInstrument');
        return;
      }

      // Implement LRU-like behavior to prevent memory leaks
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        // Remove oldest entries
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        // Remove the oldest 10% of entries
        const toRemove = Math.floor(this.MAX_CACHE_SIZE * 0.1);
        for (let i = 0; i < toRemove; i++) {
          this.cache.delete(entries[i][0]);
        }
      }

      this.cache.set(symbol, {
        info,
        timestamp: Date.now()
      });

      console.log(`📋 Cached instrument info for ${symbol}`);
    } catch (error) {
      console.error(`Error caching instrument for ${symbol}:`, error);
    }
  }

  /**
   * Clear all cached instrument data
   */
  static clearCache(): void {
    try {
      const size = this.cache.size;
      this.cache.clear();
      console.log(`🧹 Cleared instrument cache (${size} entries)`);
    } catch (error) {
      console.error('Error clearing instrument cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; expired: number } {
    try {
      const now = Date.now();
      let expired = 0;

      for (const [symbol, cached] of this.cache.entries()) {
        if (now - cached.timestamp > this.CACHE_TTL_MS) {
          expired++;
        }
      }

      return {
        size: this.cache.size,
        expired
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { size: 0, expired: 0 };
    }
  }

  /**
   * Clean up expired entries
   */
  static cleanupExpired(): void {
    try {
      const now = Date.now();
      const toDelete: string[] = [];

      for (const [symbol, cached] of this.cache.entries()) {
        if (now - cached.timestamp > this.CACHE_TTL_MS) {
          toDelete.push(symbol);
        }
      }

      toDelete.forEach(symbol => this.cache.delete(symbol));
      
      if (toDelete.length > 0) {
        console.log(`🧹 Cleaned up ${toDelete.length} expired cache entries`);
      }
    } catch (error) {
      console.error('Error cleaning up expired cache entries:', error);
    }
  }
}
