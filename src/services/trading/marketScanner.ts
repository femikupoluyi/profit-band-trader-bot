
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
    // Clear ALL historical data first to remove any cache
    await this.clearAllHistoricalData();
    
    // Use trading pairs from config
    const symbols = this.config.trading_pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];
    
    console.log('🔍 SCANNING MARKETS on Bybit DEMO trading for symbols:', symbols);
    console.log('Chart timeframe from config:', this.config.chart_timeframe);
    
    for (const symbol of symbols) {
      try {
        console.log(`📊 Getting REAL-TIME price for ${symbol} from Bybit DEMO trading (FRESH DATA)...`);
        
        // Always fetch fresh real-time price from DEMO trading API
        const marketPrice = await this.getRealtimePrice(symbol);
        console.log(`✅ ${symbol} LIVE DEMO trading price: $${marketPrice.price.toFixed(6)}`);
        
        // Store current market data with real-time price
        const { error: insertError } = await supabase
          .from('market_data')
          .insert({
            symbol,
            price: marketPrice.price,
            timestamp: new Date().toISOString(),
            source: 'bybit_demo_realtime',
          });

        if (insertError) {
          console.error(`❌ Error storing market data for ${symbol}:`, insertError);
          await this.logActivity('error', `Failed to store market data for ${symbol}`, { 
            error: insertError.message,
            price: marketPrice.price,
            source: 'bybit_demo_trading'
          });
        } else {
          console.log(`✅ Market data stored for ${symbol} - DEMO trading Price: $${marketPrice.price.toFixed(6)}`);
        }
        
      } catch (error) {
        console.error(`❌ Error scanning ${symbol} on DEMO trading:`, error);
        await this.logActivity('error', `Failed to scan ${symbol} on DEMO trading - API call failed`, { 
          error: error instanceof Error ? error.message : 'Unknown error',
          symbol,
          timestamp: new Date().toISOString(),
          source: 'bybit_demo_trading'
        });
      }
    }
    
    console.log('✅ MARKET SCAN COMPLETED - All prices fetched from DEMO trading in real-time');
  }

  private async clearAllHistoricalData(): Promise<void> {
    try {
      console.log('🧹 Clearing ALL historical market data and cache...');
      
      // Delete all historical market data to ensure fresh start
      const { error } = await supabase
        .from('market_data')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
      
      if (error) {
        console.error('❌ Error clearing historical data:', error);
      } else {
        console.log('✅ ALL historical market data and cache cleared successfully');
      }
    } catch (error) {
      console.error('❌ Failed to clear historical data:', error);
    }
  }

  private async getRealtimePrice(symbol: string): Promise<{ price: number }> {
    try {
      console.log(`🔄 Fetching LIVE price for ${symbol} from Bybit DEMO trading API (NO CACHE)...`);
      
      // Force a fresh API call to Bybit DEMO trading - absolutely no caching
      const marketPrice = await this.bybitService.getMarketPrice(symbol);
      
      console.log(`📈 FRESH price received for ${symbol} from DEMO trading: $${marketPrice.price.toFixed(6)}`);
      
      // Validate the price is reasonable
      if (marketPrice.price <= 0 || !isFinite(marketPrice.price)) {
        throw new Error(`Invalid price received for ${symbol}: ${marketPrice.price}`);
      }
      
      return { price: marketPrice.price };
    } catch (error) {
      console.error(`❌ Failed to fetch real-time price for ${symbol} from DEMO trading:`, error);
      await this.logActivity('error', `Real-time price fetch failed for ${symbol} on DEMO trading`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        symbol,
        timestamp: new Date().toISOString(),
        source: 'bybit_demo_trading_api'
      });
      throw error;
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
