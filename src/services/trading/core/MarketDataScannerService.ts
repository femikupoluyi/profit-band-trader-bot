
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';

export class MarketDataScannerService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private lastPrices: Map<string, number> = new Map();

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.bybitService.setLogger(this.logger);
  }

  async scanMarkets(config: TradingConfigData): Promise<void> {
    try {
      console.log(`📊 Scanning ${config.trading_pairs.length} markets...`);
      await this.logger.logSuccess(`Scanning ${config.trading_pairs.length} markets`);

      // Clear old market data (older than last cycle)
      await this.clearOldMarketData();

      for (const symbol of config.trading_pairs) {
        await this.scanSymbol(symbol);
      }

      console.log('✅ Market scan completed');
      await this.logger.logSuccess('Market scan completed');
    } catch (error) {
      console.error('❌ Error scanning markets:', error);
      await this.logger.logError('Error scanning markets', error);
      throw error;
    }
  }

  private async clearOldMarketData(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      
      const { error } = await supabase
        .from('market_data')
        .delete()
        .lt('timestamp', cutoffTime.toISOString());

      if (error) {
        console.error('Error clearing old market data:', error);
        await this.logger.logError('Error clearing old market data', error);
      }
    } catch (error) {
      console.error('Error clearing old market data:', error);
      await this.logger.logError('Error clearing old market data', error);
    }
  }

  private async scanSymbol(symbol: string): Promise<void> {
    try {
      console.log(`📈 Fetching price for ${symbol}...`);
      
      const marketPrice = await this.bybitService.getMarketPrice(symbol);
      const currentPrice = marketPrice.price;

      // Check for price jumps (basic validation)
      const lastPrice = this.lastPrices.get(symbol);
      if (lastPrice && Math.abs((currentPrice - lastPrice) / lastPrice) > 0.1) {
        console.log(`⚠️ Large price jump detected for ${symbol}: ${lastPrice} -> ${currentPrice}`);
        await this.logger.logSuccess(`Large price jump detected for ${symbol}`, {
          symbol,
          lastPrice,
          currentPrice,
          changePercent: ((currentPrice - lastPrice) / lastPrice * 100).toFixed(2)
        });
      }

      // Store current price
      this.lastPrices.set(symbol, currentPrice);

      // Insert into database
      const { error } = await supabase
        .from('market_data')
        .insert({
          symbol,
          price: currentPrice,
          timestamp: new Date().toISOString(),
          source: 'bybit_main_realtime'
        });

      if (error) {
        console.error(`❌ Error storing market data for ${symbol}:`, error);
        await this.logger.logError(`Error storing market data for ${symbol}`, error, { symbol });
      } else {
        console.log(`✅ ${symbol}: $${currentPrice.toFixed(4)}`);
      }

    } catch (error) {
      console.error(`❌ Error scanning ${symbol}:`, error);
      await this.logger.logError(`Failed to scan ${symbol}`, error, { symbol });
    }
  }
}
