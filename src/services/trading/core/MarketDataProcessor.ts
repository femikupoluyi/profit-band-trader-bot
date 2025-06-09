
import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './TradingLogger';

export class MarketDataProcessor {
  private userId: string;
  private logger: TradingLogger;
  private lastPrices: Map<string, number> = new Map();

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  async validatePriceChange(symbol: string, currentPrice: number): Promise<void> {
    const lastPrice = this.lastPrices.get(symbol);
    if (lastPrice && Math.abs((currentPrice - lastPrice) / lastPrice) > 0.1) {
      const changePercent = ((currentPrice - lastPrice) / lastPrice * 100).toFixed(2);
      console.log(`⚠️ Large price jump detected for ${symbol}: ${lastPrice} -> ${currentPrice} (${changePercent}%)`);
      await this.logger.logSuccess(`Price jump detected for ${symbol}`, {
        symbol,
        lastPrice,
        currentPrice,
        changePercent
      });
    }
  }

  updateLastPrice(symbol: string, price: number): void {
    this.lastPrices.set(symbol, price);
  }

  async storeMarketData(symbol: string, price: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('market_data')
        .insert({
          symbol,
          price,
          timestamp: new Date().toISOString(),
          source: 'bybit_edge_function'
        });

      if (error) {
        console.error(`❌ Error storing market data for ${symbol}:`, error);
        await this.logger.logError(`Error storing market data for ${symbol}`, error, { symbol, price });
      }
    } catch (error) {
      console.error(`❌ Database error for ${symbol}:`, error);
      await this.logger.logError(`Database error storing ${symbol}`, error, { symbol, price });
    }
  }

  async clearOldMarketData(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      
      const { error } = await supabase
        .from('market_data')
        .delete()
        .lt('timestamp', cutoffTime.toISOString());

      if (error) {
        console.error('Error clearing old market data:', error);
        await this.logger.logError('Error clearing old market data', error);
      } else {
        console.log('🧹 Old market data cleared successfully');
      }
    } catch (error) {
      console.error('Error clearing old market data:', error);
      await this.logger.logError('Error clearing old market data', error);
    }
  }

  getLastPrices(): Record<string, number> {
    return Object.fromEntries(this.lastPrices);
  }
}
