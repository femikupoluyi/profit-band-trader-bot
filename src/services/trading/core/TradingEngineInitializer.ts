
import { TradingConfigManager } from '../config/TradingConfigManager';
import { TradingLogger } from './TradingLogger';
import { ConfigConverter } from './ConfigConverter';
import { ConfigurableFormatter } from './ConfigurableFormatter';

export class TradingEngineInitializer {
  private userId: string;
  private logger: TradingLogger;
  private configManager: TradingConfigManager;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
    this.configManager = TradingConfigManager.getInstance(userId);
  }

  async initialize(): Promise<void> {
    try {
      console.log('\n🔄 ===== MAIN TRADING ENGINE INITIALIZATION =====');
      await this.logger.logEngineStatusChange('initializing');
      
      // Load initial configuration
      await this.configManager.loadConfig();
      const config = this.configManager.getConfig();
      const configData = ConfigConverter.convertConfig(config);
      
      console.log('⚙️ Configuration loaded:', {
        isActive: config.is_active,
        tradingPairs: config.trading_pairs?.length || 0,
        maxOrderAmount: config.maximum_order_amount_usd,
        takeProfitPercent: config.take_profit_percentage,
        mainLoopInterval: config.main_loop_interval_seconds
      });

      await this.logger.logConfigurationChange({
        action: 'configuration_loaded',
        details: {
          isActive: config.is_active,
          tradingPairsCount: config.trading_pairs?.length || 0,
          maxOrderAmount: config.maximum_order_amount_usd,
          takeProfitPercent: config.take_profit_percentage,
          mainLoopInterval: config.main_loop_interval_seconds
        }
      });
      
      // Initialize ConfigurableFormatter with current config
      ConfigurableFormatter.setConfig(configData);
      
      console.log('✅ Main Trading Engine initialized successfully');
      await this.logger.logEngineStatusChange('initialized', {
        configLoaded: true,
        isActive: config.is_active,
        tradingPairsCount: config.trading_pairs?.length || 0
      });
    } catch (error) {
      console.error('❌ Failed to initialize Main Trading Engine:', error);
      await this.logger.logError('Failed to initialize Main Trading Engine', error);
      throw error;
    }
  }

  getConfigManager(): TradingConfigManager {
    return this.configManager;
  }

  getLogger(): TradingLogger {
    return this.logger;
  }
}
