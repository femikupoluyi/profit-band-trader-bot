
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { MarketDataProcessor } from './MarketDataProcessor';
import { MarketDataBatchProcessor } from './MarketDataBatchProcessor';

export class MarketDataScannerService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private marketDataProcessor: MarketDataProcessor;
  private batchProcessor: MarketDataBatchProcessor;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.marketDataProcessor = new MarketDataProcessor(userId);
    this.batchProcessor = new MarketDataBatchProcessor(userId, bybitService);
    this.bybitService.setLogger(this.logger);
  }

  async scanMarkets(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n📊 ===== MARKET DATA SCAN START =====');
      console.log(`📊 Scanning ${config.trading_pairs.length} markets using edge function...`);
      await this.logger.logSuccess(`Starting market scan for ${config.trading_pairs.length} pairs`, {
        tradingPairs: config.trading_pairs,
        scanMethod: 'edge_function'
      });

      // Clear old market data
      console.log('🧹 Clearing old market data...');
      await this.marketDataProcessor.clearOldMarketData();

      // Process symbols with controlled concurrency
      console.log(`🔄 Processing symbols in batches of 2...`);
      const results = await this.batchProcessor.processSymbolsBatch(config.trading_pairs, 2);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      console.log(`📊 ===== MARKET SCAN SUMMARY =====
        - Total symbols: ${results.length}
        - Successful: ${successCount}
        - Failed: ${failureCount}`);

      await this.logger.logSuccess(`Market scan completed: ${successCount}/${results.length} successful`, {
        totalSymbols: results.length,
        successful: successCount,
        failed: failureCount,
        results: results
      });

      // Log connection health status
      const connectionStatus = this.batchProcessor.getConnectionHealth();
      console.log('🔗 Connection Health Status:', connectionStatus);
      await this.logger.logSystemInfo('Connection health status', connectionStatus);

    } catch (error) {
      console.error('❌ Error in market scan:', error);
      await this.logger.logError('Market scan failed completely', error);
      throw error;
    }
  }

  // Public method to get connection health for monitoring
  getConnectionHealth(): Record<string, any> {
    return this.batchProcessor.getConnectionHealth();
  }
}
