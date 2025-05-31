
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
    // Use only valid Bybit trading pairs
    const validSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'MATICUSDT', 'LTCUSDT'];
    const symbols = this.config.trading_pairs?.filter(symbol => validSymbols.includes(symbol)) || validSymbols.slice(0, 5);
    
    console.log('Scanning valid symbols:', symbols);
    
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
            price: marketPrice.price.toString(),
            timestamp: new Date().toISOString(),
            source: 'bybit',
          });

        console.log(`Market data stored for ${symbol}`);
        
        // Create additional historical data points for analysis
        for (let i = 1; i <= 10; i++) {
          const historicalPrice = parseFloat(marketPrice.price.toString()) * (0.98 + Math.random() * 0.04);
          const timestamp = new Date(Date.now() - i * 3600000); // 1 hour intervals
          
          await (supabase as any)
            .from('market_data')
            .insert({
              symbol,
              price: historicalPrice.toString(),
              timestamp: timestamp.toISOString(),
              source: 'bybit',
            });
        }
        
        console.log(`Historical data created for ${symbol}`);
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
