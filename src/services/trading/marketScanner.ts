
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class MarketScanner {
  private userId: string;
  private bybitService: BybitService;
  private config: TradingConfigData;

  constructor(userId: string, bybitService: BybitService, config: TradingConfigData) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.config = config;
  }

  async scanMarkets(): Promise<void> {
    // Use trading pairs from config
    const symbols = this.config.trading_pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 'POLUSDT', 'FETUSDT', 'XRPUSDT', 'XLMUSDT'];
    console.log('Scanning symbols:', symbols);
    
    for (const symbol of symbols) {
      try {
        console.log(`Getting price for ${symbol}...`);
        const marketPrice = await this.bybitService.getMarketPrice(symbol);
        console.log(`${symbol} price: $${marketPrice.price}`);
        
        // Store market data
        await (supabase as any)
          .from('market_data')
          .insert({
            symbol,
            price: marketPrice.price,
            timestamp: new Date().toISOString(),
            source: 'bybit',
          });

        console.log(`Market data stored for ${symbol}`);
      } catch (error) {
        console.error(`Error scanning ${symbol}:`, error);
        await this.logActivity('error', `Failed to scan ${symbol}`, { error: error.message });
      }
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await (supabase as any)
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: type,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
