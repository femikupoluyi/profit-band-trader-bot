
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
    
    console.log('Scanning markets for symbols from config:', symbols);
    console.log('Chart timeframe from config:', this.config.chart_timeframe);
    
    for (const symbol of symbols) {
      try {
        console.log(`Getting price for ${symbol}...`);
        
        // Get market price (currently mock, but structured for real API integration)
        const marketPrice = await this.getRealtimePrice(symbol);
        console.log(`${symbol} price: $${marketPrice.price}`);
        
        // Store current market data - fix type issue by converting price to string
        await supabase
          .from('market_data')
          .insert({
            symbol,
            price: marketPrice.price.toString(),
            timestamp: new Date().toISOString(),
            source: 'bybit',
          });

        console.log(`Market data stored for ${symbol}`);
        
        // Create additional historical data points for analysis (temporary until real historical data is available)
        await this.createHistoricalDataPoints(symbol, marketPrice.price);
        
        console.log(`Historical data created for ${symbol}`);
      } catch (error) {
        console.error(`Error scanning ${symbol}:`, error);
        await this.logActivity('error', `Failed to scan ${symbol}`, { error: error.message });
      }
    }
  }

  private async getRealtimePrice(symbol: string): Promise<{ price: number }> {
    try {
      // TODO: Replace with actual real-time price fetching when ready
      // For now, using Bybit service which returns mock data
      const marketPrice = await this.bybitService.getMarketPrice(symbol);
      
      // In a real implementation, this would fetch from:
      // 1. Bybit WebSocket API for real-time prices
      // 2. REST API endpoints for current market data
      // 3. Alternative price feeds as backup
      
      console.log(`Fetched real-time price for ${symbol}: $${marketPrice.price} (currently mock)`);
      
      return { price: marketPrice.price };
    } catch (error) {
      console.error(`Error fetching real-time price for ${symbol}:`, error);
      throw error;
    }
  }

  private async createHistoricalDataPoints(symbol: string, currentPrice: number): Promise<void> {
    // Create historical price points for technical analysis
    // This simulates price movement - in production, fetch real historical data
    const candleCount = this.config.support_candle_count || 20;
    
    for (let i = 1; i <= candleCount; i++) {
      const historicalPrice = currentPrice * (0.98 + Math.random() * 0.04);
      const timestamp = new Date(Date.now() - i * 3600000); // 1 hour intervals based on timeframe
      
      await supabase
        .from('market_data')
        .insert({
          symbol,
          price: historicalPrice.toString(), // Convert to string to match database type
          timestamp: timestamp.toISOString(),
          source: 'bybit',
        });
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
