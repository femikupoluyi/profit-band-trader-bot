
import { TradingLogger } from './TradingLogger';
import { MarketDataProcessor } from './MarketDataProcessor';
import { ApiConnectionManager } from './ApiConnectionManager';
import { RateLimiter } from './RateLimiter';
import { BybitService } from '../../bybitService';

interface BatchProcessingResult {
  symbol: string;
  success: boolean;
  reason?: string;
}

export class MarketDataBatchProcessor {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private connectionManager: ApiConnectionManager;
  private rateLimiter: RateLimiter;
  private marketDataProcessor: MarketDataProcessor;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.connectionManager = new ApiConnectionManager(userId);
    this.rateLimiter = new RateLimiter(10, 60000);
    this.marketDataProcessor = new MarketDataProcessor(userId);
  }

  async processSymbolsBatch(symbols: string[], batchSize: number): Promise<BatchProcessingResult[]> {
    const results: BatchProcessingResult[] = [];
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(symbols.length/batchSize)}: [${batch.join(', ')}]`);
      
      const batchPromises = batch.map(symbol => this.scanSymbolWithRetry(symbol));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        const symbol = batch[index];
        if (result.status === 'fulfilled') {
          results.push({ symbol, success: result.value.success, reason: result.value.reason });
        } else {
          results.push({ symbol, success: false, reason: result.reason?.toString() || 'Unknown error' });
          console.error(`❌ Final failure for ${symbol}:`, result.reason);
        }
      });

      // Add delay between batches
      if (i + batchSize < symbols.length) {
        console.log('⏳ Waiting between batches...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    return results;
  }

  private async scanSymbolWithRetry(symbol: string, maxRetries: number = 2): Promise<{ success: boolean; reason?: string }> {
    const endpoint = 'bybit-edge-function';
    
    // Check circuit breaker
    if (!this.connectionManager.isConnectionHealthy(endpoint)) {
      console.log(`🚫 Skipping ${symbol} - circuit breaker is open`);
      return { success: false, reason: 'Circuit breaker open' };
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Apply rate limiting
        await this.rateLimiter.waitForPermission();
        
        console.log(`📈 Attempt ${attempt}/${maxRetries}: Fetching price for ${symbol} via edge function...`);
        
        const startTime = Date.now();
        const marketPrice = await this.bybitService.getMarketPrice(symbol);
        const endTime = Date.now();
        const currentPrice = marketPrice.price;

        console.log(`⏱️ ${symbol}: Price fetch took ${endTime - startTime}ms`);

        // Validate price
        if (!currentPrice || currentPrice <= 0 || !isFinite(currentPrice)) {
          throw new Error(`Invalid price received: ${currentPrice}`);
        }

        // Process market data
        await this.marketDataProcessor.validatePriceChange(symbol, currentPrice);
        this.marketDataProcessor.updateLastPrice(symbol, currentPrice);
        await this.marketDataProcessor.storeMarketData(symbol, currentPrice);
        
        // Record success
        this.connectionManager.recordSuccess(endpoint);
        console.log(`✅ ${symbol}: $${currentPrice.toFixed(6)} (attempt ${attempt}, took ${endTime - startTime}ms)`);
        
        await this.logger.logMarketDataUpdate(symbol, currentPrice, 'bybit_edge_function');
        
        return { success: true };

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
          finalAttempt: true,
          errorMessage: error.message
        });
        
        return { success: false, reason: error.message };
      }
    }
    
    return { success: false, reason: 'Max retries exceeded' };
  }

  // Public method to get connection health for monitoring
  getConnectionHealth(): Record<string, any> {
    return {
      connections: this.connectionManager.getConnectionStatus(),
      rateLimiter: this.rateLimiter.getStatus(),
      lastPrices: this.marketDataProcessor.getLastPrices()
    };
  }
}
