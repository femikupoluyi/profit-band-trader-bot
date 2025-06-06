
import { BybitService } from '@/services/bybitService';
import { ConfigurableFormatter } from './ConfigurableFormatter';
import { supabase } from '@/integrations/supabase/client';

export class TradingPairsService {
  private static cachedTradingPairs: string[] = [];
  private static lastFetchTime: number = 0;
  private static readonly CACHE_TTL_MS = 3600000; // 1 hour

  /**
   * Fetch active trading pairs from Bybit exchange dynamically
   */
  static async fetchActiveTradingPairs(bybitService: BybitService): Promise<string[]> {
    try {
      // Use cached data if it's still fresh
      const now = Date.now();
      if (this.cachedTradingPairs.length > 0 && 
          (now - this.lastFetchTime) < this.CACHE_TTL_MS) {
        console.log(`Using cached trading pairs: ${this.cachedTradingPairs.length} symbols`);
        return this.cachedTradingPairs;
      }

      console.log('🔄 Fetching active trading pairs from Bybit...');
      
      // Fetch all spot symbols from Bybit
      const { data: response, error } = await supabase.functions.invoke('bybit-api', {
        body: {
          endpoint: '/v5/market/instruments-info',
          method: 'GET',
          params: {
            category: 'spot'
          },
          isDemoTrading: true
        }
      });

      if (error) {
        console.error('❌ Error fetching trading pairs from Bybit:', error);
        return this.getFallbackPairs();
      }

      if (response?.retCode !== 0) {
        console.error('❌ Bybit API error:', response?.retMsg);
        return this.getFallbackPairs();
      }

      const instrumentList = response.result?.list;
      if (!instrumentList || !Array.isArray(instrumentList)) {
        console.error('❌ Invalid response from Bybit instruments API');
        return this.getFallbackPairs();
      }

      // Filter for USDT pairs and active symbols
      const usdtPairs = instrumentList
        .filter(instrument => 
          instrument.symbol &&
          instrument.symbol.endsWith('USDT') &&
          instrument.status === 'Trading'
        )
        .map(instrument => instrument.symbol)
        .sort();

      console.log(`✅ Fetched ${usdtPairs.length} active USDT trading pairs from Bybit`);

      // Update the cache
      this.cachedTradingPairs = usdtPairs;
      this.lastFetchTime = now;
      
      // Also update the ConfigurableFormatter
      ConfigurableFormatter.setActivePairs(usdtPairs);
      
      return usdtPairs;
    } catch (error) {
      console.error('❌ Exception fetching active trading pairs:', error);
      return this.getFallbackPairs();
    }
  }

  /**
   * Get trading pairs from user configuration
   */
  static async getConfiguredTradingPairs(userId: string): Promise<string[]> {
    try {
      console.log('🔄 Loading trading pairs from user configuration...');
      
      const { data: config, error } = await supabase
        .from('trading_configs')
        .select('trading_pairs')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.log('⚠️ No user config found, using fallback pairs');
        return this.getFallbackPairs();
      }

      if (config?.trading_pairs && Array.isArray(config.trading_pairs) && config.trading_pairs.length > 0) {
        console.log(`✅ Loaded ${config.trading_pairs.length} trading pairs from user config`);
        return config.trading_pairs;
      }

      console.log('⚠️ User config has no trading pairs, using fallback pairs');
      return this.getFallbackPairs();
    } catch (error) {
      console.error('❌ Error loading configured trading pairs:', error);
      return this.getFallbackPairs();
    }
  }

  /**
   * Get fallback trading pairs if API call fails
   */
  private static getFallbackPairs(): string[] {
    const fallbackPairs = [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 
      'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'MATICUSDT', 'FETUSDT', 
      'POLUSDT', 'XLMUSDT', 'AVAXUSDT', 'DOTUSDT', 'SHIBUSDT'
    ];
    
    this.cachedTradingPairs = fallbackPairs;
    this.lastFetchTime = Date.now();
    ConfigurableFormatter.setActivePairs(fallbackPairs);
    
    return fallbackPairs;
  }

  /**
   * Get the current list of active trading pairs
   */
  static getCurrentPairs(): string[] {
    return this.cachedTradingPairs.length > 0 
      ? this.cachedTradingPairs 
      : this.getFallbackPairs();
  }

  /**
   * Check if a trading pair is supported and configured
   */
  static async isPairConfiguredForTrading(symbol: string, userId: string): Promise<boolean> {
    try {
      const configuredPairs = await this.getConfiguredTradingPairs(userId);
      const isConfigured = configuredPairs.includes(symbol);
      const isSupported = this.getCurrentPairs().includes(symbol);
      
      console.log(`📊 Symbol ${symbol}: configured=${isConfigured}, supported=${isSupported}`);
      return isConfigured && isSupported;
    } catch (error) {
      console.error(`❌ Error checking if pair ${symbol} is configured:`, error);
      return false;
    }
  }

  /**
   * Check if a trading pair is supported by the exchange
   */
  static isPairSupported(symbol: string): boolean {
    return this.getCurrentPairs().includes(symbol);
  }

  /**
   * Force refresh the trading pairs cache
   */
  static async refreshTradingPairs(bybitService: BybitService): Promise<string[]> {
    this.cachedTradingPairs = [];
    this.lastFetchTime = 0;
    return this.fetchActiveTradingPairs(bybitService);
  }
}
