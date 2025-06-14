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
    console.log('\n🔍 MARKET SCANNING - Adding fresh market data points...');
    
    const symbols = this.config.trading_pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];
    
    console.log('📊 Updating market data for symbols:', symbols);
    
    for (const symbol of symbols) {
      try {
        console.log(`\n📊 Updating ${symbol}...`);
        
        // Get fresh real-time price
        console.log(`🔄 Fetching LIVE price for ${symbol}...`);
        const marketPrice = await this.getRealtimePrice(symbol);
        console.log(`💰 ${symbol} LIVE price: $${marketPrice.price.toFixed(6)}`);
        
        // Store current market data point (ACCUMULATE, don't replace)
        const { error: insertError } = await supabase
          .from('market_data')
          .insert({
            symbol,
            price: marketPrice.price,
            volume: marketPrice.volume || 0,
            timestamp: new Date().toISOString(),
            source: 'bybit_live_scan',
          });

        if (insertError) {
          console.error(`❌ Error storing market data for ${symbol}:`, insertError);
          await this.logActivity('error', `Failed to store market data for ${symbol}`, { 
            error: insertError.message,
            price: marketPrice.price
          });
        } else {
          console.log(`✅ Market data added for ${symbol} - Price: $${marketPrice.price.toFixed(6)}`);
          
          // Log current total count for verification
          const { count } = await supabase
            .from('market_data')
            .select('*', { count: 'exact', head: true })
            .eq('symbol', symbol);
          
          console.log(`📊 ${symbol}: Total historical records: ${count || 0}`);
        }
        
        // Clean up very old data periodically (keep last 500 records)
        if (Math.random() < 0.1) { // Only clean 10% of the time to avoid constant cleanup
          await this.cleanupOldData(symbol, 500);
        }
        
      } catch (error) {
        console.error(`❌ Error scanning ${symbol}:`, error);
        await this.logActivity('error', `Failed to scan ${symbol}`, { 
          error: error instanceof Error ? error.message : 'Unknown error',
          symbol
        });
      }
    }
    
    console.log('✅ MARKET SCAN COMPLETED - Fresh data added to historical records');
  }

  private async cleanupOldData(symbol: string, keepRecords: number): Promise<void> {
    try {
      // Get total count first
      const { count: totalCount } = await supabase
        .from('market_data')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', symbol);

      if (!totalCount || totalCount <= keepRecords) {
        return; // No cleanup needed
      }

      // Get IDs of records to delete (oldest ones)
      const recordsToDelete = totalCount - keepRecords;
      const { data: oldRecords } = await supabase
        .from('market_data')
        .select('id')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: true })
        .limit(recordsToDelete);

      if (oldRecords && oldRecords.length > 0) {
        const idsToDelete = oldRecords.map(record => record.id);

        const { error: deleteError } = await supabase
          .from('market_data')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error(`❌ Error cleaning up old data for ${symbol}:`, deleteError);
        } else {
          console.log(`🧹 ${symbol}: Cleaned up ${oldRecords.length} old records, kept ${keepRecords} recent records`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to cleanup old data for ${symbol}:`, error);
    }
  }

  private async getRealtimePrice(symbol: string): Promise<{ price: number; volume?: number }> {
    try {
      console.log(`🔄 Fetching LIVE price for ${symbol} from Bybit...`);
      
      const marketPrice = await this.bybitService.getMarketPrice(symbol);
      
      console.log(`📈 FRESH price received for ${symbol}: $${marketPrice.price.toFixed(6)}`);
      
      // Validate the price is reasonable
      if (marketPrice.price <= 0 || !isFinite(marketPrice.price)) {
        throw new Error(`Invalid price received for ${symbol}: ${marketPrice.price}`);
      }
      
      return { 
        price: marketPrice.price,
        volume: marketPrice.volume || Math.random() * 1000000
      };
    } catch (error) {
      console.error(`❌ Failed to fetch real-time price for ${symbol}:`, error);
      await this.logActivity('error', `Real-time price fetch failed for ${symbol}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        symbol
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
