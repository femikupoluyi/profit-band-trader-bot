import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';
import { ApiConnectionManager } from './ApiConnectionManager';
import { RateLimiter } from './RateLimiter';

export class MarketDataScannerService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private connectionManager: ApiConnectionManager;
  private rateLimiter: RateLimiter;
  private lastPrices: Map<string, number> = new Map();

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.connectionManager = new ApiConnectionManager(userId);
    this.rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute for edge function
    this.bybitService.setLogger(this.logger);
  }

  async scanMarkets(config: TradingConfigData): Promise<void> {
    try {
      console.log(`📊 Scanning ${config.trading_pairs.length} markets using edge function...`);
      await this.logger.logSuccess(`Starting market scan for ${config.trading_pairs.length} pairs`);

      // Clear old market data
      await this.clearOldMarketData();

      // Process symbols with controlled concurrency - reduced for edge function
      const results = await this.processSymbolsBatch(config.trading_pairs, 2); // Max 2 concurrent requests

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      console.log(`📊 Market scan completed: ${successCount} successful, ${failureCount} failed`);
      await this.logger.logSuccess(`Market scan completed: ${successCount}/${results.length} successful`);

      // Log connection health status
      const connectionStatus = this.connectionManager.getConnectionStatus();
      console.log('🔗 Connection Health Status:', connectionStatus);

    } catch (error) {
      console.error('❌ Error in market scan:', error);
      await this.logger.logError('Market scan failed completely', error);
      throw error;
    }
  }

  private async processSymbolsBatch(symbols: string[], batchSize: number): Promise<Array<{symbol: string, success: boolean}>> {
    const results: Array<{symbol: string, success: boolean}> = [];
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(symbols.length/batchSize)}: [${batch.join(', ')}]`);
      
      const batchPromises = batch.map(symbol => this.scanSymbolWithRetry(symbol));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        const symbol = batch[index];
        const success = result.status === 'fulfilled' && result.value;
        results.push({ symbol, success });
        
        if (!success && result.status === 'rejected') {
          console.error(`❌ Final failure for ${symbol}:`, result.reason);
        }
      });

      // Add delay between batches
      if (i + batchSize < symbols.length) {
        console.log('⏳ Waiting between batches...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Increased delay for edge function
      }
    }
    
    return results;
  }

  private async scanSymbolWithRetry(symbol: string, maxRetries: number = 2): Promise<boolean> {
    const endpoint = 'bybit-edge-function';
    
    // Check circuit breaker
    if (!this.connectionManager.isConnectionHealthy(endpoint)) {
      console.log(`🚫 Skipping ${symbol} - circuit breaker is open`);
      return false;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Apply rate limiting
        await this.rateLimiter.waitForPermission();
        
        console.log(`📈 Attempt ${attempt}/${maxRetries}: Fetching price for ${symbol} via edge function...`);
        
        const marketPrice = await this.bybitService.getMarketPrice(symbol);
        const currentPrice = marketPrice.price;

        // Validate price
        if (!currentPrice || currentPrice <= 0 || !isFinite(currentPrice)) {
          throw new Error(`Invalid price received: ${currentPrice}`);
        }

        // Check for suspicious price jumps
        await this.validatePriceChange(symbol, currentPrice);

        // Store price and market data
        this.lastPrices.set(symbol, currentPrice);
        await this.storeMarketData(symbol, currentPrice);
        
        // Record success
        this.connectionManager.recordSuccess(endpoint);
        console.log(`✅ ${symbol}: $${currentPrice.toFixed(6)} (attempt ${attempt})`);
        
        return true;

      } catch (error) {
        console.error(`❌ Attempt ${attempt}/${maxRetries} failed for ${symbol}:`, error);
        
        // Record failure in connection manager
        this.connectionManager.recordFailure(endpoint, error);
        
        // Check if we should retry
        if (attempt < maxRetries && this.connectionManager.shouldRetry(error)) {
          const delay = this.connectionManager.getRetryDelay(attempt);
          console.log(`⏳ Retrying ${symbol} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Final failure
        await this.logger.logError(`Failed to scan ${symbol} after ${maxRetries} attempts`, error, { 
          symbol, 
          attempts: attempt,
          finalAttempt: true 
        });
        
        return false;
      }
    }
    
    return false;
  }

  private async validatePriceChange(symbol: string, currentPrice: number): Promise<void> {
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

  private async storeMarketData(symbol: string, price: number): Promise<void> {
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

  private async clearOldMarketData(): Promise<void> {
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

  // Public method to get connection health for monitoring
  getConnectionHealth(): Record<string, any> {
    return {
      connections: this.connectionManager.getConnectionStatus(),
      rateLimiter: this.rateLimiter.getStatus(),
      lastPrices: Object.fromEntries(this.lastPrices)
    };
  }
}
