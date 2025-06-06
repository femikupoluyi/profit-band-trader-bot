
import { TradingConfigManager } from '../../config/TradingConfigManager';
import { ConfigurableFormatter } from '../ConfigurableFormatter';
import { ConfigConverter } from '../ConfigConverter';
import { TradingLogger } from '../TradingLogger';

export class TradingEngineInitializer {
  private userId: string;
  private configManager: TradingConfigManager;
  private logger: TradingLogger;

  constructor(userId: string, configManager: TradingConfigManager, logger: TradingLogger) {
    this.userId = userId;
    this.configManager = configManager;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing Trading Engine...');
      
      // Load initial configuration
      await this.configManager.loadConfig();
      const config = this.configManager.getConfig();
      const configData = ConfigConverter.convertConfig(config);
      
      // Initialize ConfigurableFormatter with current config
      ConfigurableFormatter.setConfig(configData);
      
      console.log('✅ Trading Engine initialized successfully');
      await this.logger.logSuccess('Trading Engine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Trading Engine:', error);
      await this.logger.logError('Failed to initialize Trading Engine', error);
      throw error;
    }
  }
}
