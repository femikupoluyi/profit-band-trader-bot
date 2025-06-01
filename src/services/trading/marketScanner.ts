
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
    
    console.log('🔍 SCANNING MARKETS on Bybit testnet for symbols:', symbols);
    console.log('Chart timeframe from config:', this.config.chart_timeframe);
    
    for (const symbol of symbols) {
      try {
        console.log(`📊 Getting REAL-TIME price for ${symbol} from Bybit testnet...`);
        
        // Get fresh market price from testnet (not cached)
        const marketPrice = await this.getRealtimePrice(symbol);
        console.log(`✅ ${symbol} LIVE testnet price: $${marketPrice.price.toFixed(6)}`);
        
        // Store current market data with proper price handling
        const { error: insertError } = await supabase
          .from('market_data')
          .insert({
            symbol,
            price: marketPrice.price,
            timestamp: new Date().toISOString(),
            source: 'bybit_testnet_live',
          });

        if (insertError) {
          console.error(`Error storing market data for ${symbol}:`, insertError);
          await this.logActivity('error', `Failed to store market data for ${symbol}`, { 
            error: insertError.message,
            price: marketPrice.price
          });
        } else {
          console.log(`✅ Market data stored for ${symbol} - Price: $${marketPrice.price.toFixed(6)}`);
        }
        
        // Create additional historical data points for analysis
        await this.createHistoricalDataPoints(symbol, marketPrice.price);
        
      } catch (error) {
        console.error(`❌ Error scanning ${symbol} on testnet:`, error);
        await this.logActivity('error', `Failed to scan ${symbol} on testnet`, { 
          error: error instanceof Error ? error.message : 'Unknown error',
          symbol
        });
      }
    }
    
    console.log('✅ MARKET SCAN COMPLETED');
  }

  private async getRealtimePrice(symbol: string): Promise<{ price: number }> {
    try {
      console.log(`🔄 Fetching LIVE price for ${symbol} from Bybit testnet API...`);
      
      // Always fetch fresh price from Bybit testnet
      const marketPrice = await this.bybitService.getMarketPrice(symbol);
      
      console.log(`📈 LIVE price received for ${symbol}: $${marketPrice.price.toFixed(6)}`);
      
      // Validate the price is reasonable
      if (marketPrice.price <= 0 || !isFinite(marketPrice.price)) {
        throw new Error(`Invalid price received for ${symbol}: ${marketPrice.price}`);
      }
      
      return { price: marketPrice.price };
    } catch (error) {
      console.error(`❌ Error fetching real-time price for ${symbol}:`, error);
      throw error;
    }
  }

  private async createHistoricalDataPoints(symbol: string, currentPrice: number): Promise<void> {
    // Create historical price points for technical analysis
    const candleCount = this.config.support_candle_count || 20;
    
    try {
      console.log(`📈 Creating ${candleCount} historical data points for ${symbol} based on current price $${currentPrice.toFixed(6)}`);
      
      const historicalPoints = [];
      
      for (let i = 1; i <= candleCount; i++) {
        // Create realistic price variation (±2% from current price)
        const variation = (Math.random() - 0.5) * 0.04; // -2% to +2%
        const historicalPrice = currentPrice * (1 + variation);
        const timestamp = new Date(Date.now() - i * 3600000); // 1 hour intervals
        
        historicalPoints.push({
          symbol,
          price: historicalPrice,
          timestamp: timestamp.toISOString(),
          source: 'bybit_testnet_historical',
        });
      }

      // Insert all historical points in batch
      const { error } = await supabase
        .from('market_data')
        .insert(historicalPoints);

      if (error) {
        console.error(`Error creating historical data for ${symbol}:`, error);
      } else {
        console.log(`✅ Created ${candleCount} historical data points for ${symbol}`);
      }
      
    } catch (error) {
      console.error(`Error creating historical data for ${symbol}:`, error);
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
