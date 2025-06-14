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
    console.log('🔍 SCANNING MARKETS - Building market data history for analysis...');
    
    // Use trading pairs from config
    const symbols = this.config.trading_pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];
    
    console.log('📊 Scanning symbols:', symbols);
    console.log('📈 Target historical data points needed:', this.config.support_candle_count || 128);
    
    for (const symbol of symbols) {
      try {
        console.log(`\n📊 Processing ${symbol}...`);
        
        // Check existing data count first
        const { data: existingData, error: countError } = await supabase
          .from('market_data')
          .select('id', { count: 'exact' })
          .eq('symbol', symbol);
        
        const existingCount = existingData?.length || 0;
        console.log(`📈 ${symbol}: Existing market data records: ${existingCount}`);
        
        // Get fresh real-time price from DEMO trading API
        console.log(`🔄 Fetching LIVE price for ${symbol} from Bybit DEMO trading...`);
        const marketPrice = await this.getRealtimePrice(symbol);
        console.log(`💰 ${symbol} LIVE price: $${marketPrice.price.toFixed(6)}`);
        
        // Store current market data point
        const { error: insertError } = await supabase
          .from('market_data')
          .insert({
            symbol,
            price: marketPrice.price,
            volume: marketPrice.volume || 0,
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
          const newCount = existingCount + 1;
          console.log(`✅ Market data stored for ${symbol} - Price: $${marketPrice.price.toFixed(6)}`);
          console.log(`📊 ${symbol}: Total historical records: ${newCount}/${this.config.support_candle_count || 128}`);
          
          if (newCount >= 10) {
            console.log(`🎯 ${symbol}: Sufficient data for analysis (${newCount} records)`);
          } else {
            console.log(`⏳ ${symbol}: Need ${10 - newCount} more records for basic analysis`);
          }
        }
        
        // Clean up very old data to prevent unlimited growth (keep last 200 records)
        await this.cleanupOldData(symbol, 200);
        
      } catch (error) {
        console.error(`❌ Error scanning ${symbol}:`, error);
        await this.logActivity('error', `Failed to scan ${symbol}`, { 
          error: error instanceof Error ? error.message : 'Unknown error',
          symbol,
          timestamp: new Date().toISOString(),
          source: 'bybit_demo_trading'
        });
      }
    }
    
    console.log('✅ MARKET SCAN COMPLETED - Historical data accumulation in progress');
  }

  private async cleanupOldData(symbol: string, keepRecords: number): Promise<void> {
    try {
      // Get total count
      const { data: allData, error: countError } = await supabase
        .from('market_data')
        .select('id')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false });

      if (countError || !allData || allData.length <= keepRecords) {
        return; // No cleanup needed
      }

      // Delete older records beyond the keep limit
      const recordsToDelete = allData.slice(keepRecords);
      const idsToDelete = recordsToDelete.map(record => record.id);

      const { error: deleteError } = await supabase
        .from('market_data')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error(`❌ Error cleaning up old data for ${symbol}:`, deleteError);
      } else {
        console.log(`🧹 ${symbol}: Cleaned up ${recordsToDelete.length} old records, kept ${keepRecords} recent records`);
      }
    } catch (error) {
      console.error(`❌ Failed to cleanup old data for ${symbol}:`, error);
    }
  }

  private async getRealtimePrice(symbol: string): Promise<{ price: number; volume?: number }> {
    try {
      console.log(`🔄 Fetching LIVE price for ${symbol} from Bybit DEMO trading API...`);
      
      // Force a fresh API call to Bybit DEMO trading
      const marketPrice = await this.bybitService.getMarketPrice(symbol);
      
      console.log(`📈 FRESH price received for ${symbol}: $${marketPrice.price.toFixed(6)}`);
      
      // Validate the price is reasonable
      if (marketPrice.price <= 0 || !isFinite(marketPrice.price)) {
        throw new Error(`Invalid price received for ${symbol}: ${marketPrice.price}`);
      }
      
      return { 
        price: marketPrice.price,
        volume: marketPrice.volume || Math.random() * 1000000 // Simulate volume if not available
      };
    } catch (error) {
      console.error(`❌ Failed to fetch real-time price for ${symbol}:`, error);
      await this.logActivity('error', `Real-time price fetch failed for ${symbol}`, {
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
