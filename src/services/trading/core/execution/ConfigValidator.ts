import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { ServiceContainer } from '../ServiceContainer';
import { ConfigurationValidator } from '../ConfigurationValidator';

export class ConfigValidator {
  private userId: string;
  private configValidator: ConfigurationValidator;

  constructor(userId: string) {
    this.userId = userId;
    this.configValidator = new ConfigurationValidator(userId);
  }

  async validateConfiguration(config: TradingConfigData): Promise<void> {
    console.log(`🔧 Loading configuration for user: ${this.userId}`);
    console.log(`✅ Configuration loaded successfully: ${JSON.stringify({
      isActive: config.is_active,
      tradingPairs: config.trading_pairs.length,
      maxOrderAmount: config.max_order_amount_usd,
      maxPositionsPerPair: config.max_positions_per_pair
    }, null, 2)}`);

    // CRITICAL: Validate configuration integrity
    const configValidation = await this.configValidator.validateConfigurationIntegrity(config);
    if (!configValidation.isValid) {
      const errorMsg = `CONFIGURATION VALIDATION FAILED: ${configValidation.criticalErrors.join(', ')}`;
      console.error(`🚨 ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // CRITICAL: Real-time safety check
    const safetyCheck = await this.configValidator.performRealTimeSafetyCheck();
    if (!safetyCheck.isSafe) {
      const errorMsg = `SAFETY CHECK FAILED: ${safetyCheck.reason}`;
      console.error(`🚨 ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  async loadConfiguration(): Promise<TradingConfigData> {
    const configService = ServiceContainer.getConfigurationService(this.userId);
    const config = await configService.loadUserConfig();
    
    if (!config) {
      throw new Error('Failed to load trading configuration');
    }

    await this.validateConfiguration(config);
    return config;
  }
}