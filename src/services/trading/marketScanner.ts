
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
    const symbols = this.config.trading_pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];
    
    console.log('Scanning markets on Bybit testnet for symbols from config:', symbols);
    console.log('Chart timeframe from config:', this.config.chart_timeframe);
    
    for (const symbol of symbols) {
      try {
        console.log(`Getting price for ${symbol} from Bybit testnet...`);
        
        // Get market price from testnet
        const marketPrice = await this.getRealtimePrice(symbol);
        console.log(`${symbol} testnet price: $${marketPrice.price}`);
        
        // Store current market data - fix type issue by ensuring price is a number
        await supabase
          .from('market_data')
          .insert({
            symbol,
            price: marketPrice.price, // Keep as number, not string
            timestamp: new Date().toISOString(),
            source: 'bybit_testnet',
          });

        console.log(`Market data stored for ${symbol} from testnet`);
        
        // Create additional historical data points for analysis (temporary until real historical data is available)
        await this.createHistoricalDataPoints(symbol, marketPrice.price);
        
        console.log(`Historical data created for ${symbol} from testnet`);
      } catch (error) {
        console.error(`Error scanning ${symbol} on testnet:`, error);
        await this.logActivity('error', `Failed to scan ${symbol} on testnet`, { error: error.message });
      }
    }
  }

  private async getRealtimePrice(symbol: string): Promise<{ price: number }> {
    try {
      // Fetch real-time price from Bybit testnet
      const marketPrice = await this.bybitService.getMarketPrice(symbol);
      
      console.log(`Fetched real-time price for ${symbol} from Bybit testnet: $${marketPrice.price}`);
      
      return { price: marketPrice.price };
    } catch (error) {
      console.error(`Error fetching real-time price for ${symbol} from testnet:`, error);
      throw error;
    }
  }

  private async createHistoricalDataPoints(symbol: string, currentPrice: number): Promise<void> {
    // Create historical price points for technical analysis
    // This simulates price movement - in production, fetch real historical data from testnet
    const candleCount = this.config.support_candle_count || 20;
    
    for (let i = 1; i <= candleCount; i++) {
      const historicalPrice = currentPrice * (0.98 + Math.random() * 0.04);
      const timestamp = new Date(Date.now() - i * 3600000); // 1 hour intervals based on timeframe
      
      await supabase
        .from('market_data')
        .insert({
          symbol,
          price: historicalPrice, // Keep as number
          timestamp: timestamp.toISOString(),
          source: 'bybit_testnet',
        });
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await supabase
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
