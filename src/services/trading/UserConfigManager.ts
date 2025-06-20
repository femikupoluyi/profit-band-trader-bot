import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingPairsService } from './core/TradingPairsService';
import { TypeConverter } from './core/TypeConverter';
import { ConfigurationService } from './core/ConfigurationService';

export class UserConfigManager {
  static async getUserTradingConfig(userId: string): Promise<TradingConfigData | null> {
    if (!userId || typeof userId !== 'string') {
      console.error('❌ Invalid userId provided to getUserTradingConfig');
      return null;
    }

    try {
      console.log(`🔧 Getting trading config for user: ${userId}`);
      
      // Use the new ConfigurationService for better error handling
      const configService = new ConfigurationService(userId);
      
      // First validate access
      const hasAccess = await configService.validateConfigurationAccess();
      if (!hasAccess) {
        console.warn('⚠️ User does not have access to configuration or no config exists');
        return null;
      }

      // Load the configuration
      const config = await configService.loadUserConfig();
      if (!config) {
        console.warn('⚠️ No configuration loaded');
        return null;
      }

      // Ensure we have at least some trading pairs configured
      if (!config.trading_pairs || config.trading_pairs.length === 0) {
        console.warn('⚠️ No trading pairs configured, using defaults');
        config.trading_pairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
      }

      console.log(`✅ Successfully loaded config with ${config.trading_pairs.length} trading pairs:`, config.trading_pairs);
      return config;

    } catch (error) {
      console.error('❌ Error in getUserTradingConfig:', error);
      return null;
    }
  }

  private static validatePositiveNumber(value: any, defaultValue: number): number {
    if (value === null || value === undefined) return defaultValue;
    
    const num = typeof value === 'number' ? value : parseFloat(value?.toString() || defaultValue.toString());
    return isNaN(num) || num <= 0 ? defaultValue : num;
  }

  private static validatePositiveInteger(value: any, defaultValue: number): number {
    if (value === null || value === undefined) return defaultValue;
    
    const num = typeof value === 'number' ? value : parseInt(value?.toString() || defaultValue.toString());
    return isNaN(num) || num <= 0 || !Number.isInteger(num) ? defaultValue : num;
  }

  private static validateChartTimeframe(timeframe: any): string {
    const validTimeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'];
    return validTimeframes.includes(timeframe) ? timeframe : '4h';
  }

  private static validateMainLoopInterval(interval: any): number {
    if (interval === null || interval === undefined) return 30;
    
    const num = typeof interval === 'number' ? interval : parseInt(interval?.toString() || '30');
    return isNaN(num) || num < 10 || num > 600 ? 30 : num;
  }

  private static validateAndNormalizeTime(timeStr: any): string | null {
    if (!timeStr || typeof timeStr !== 'string') return null;
    
    const timeRegexHHMMSS = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    if (timeRegexHHMMSS.test(timeStr)) {
      return timeStr;
    }
    
    const timeRegexHHMM = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (timeRegexHHMM.test(timeStr)) {
      return timeStr + ':00';
    }
    
    return null;
  }

  private static validateJSONBObject(value: any, defaultValue: Record<string, number>): Record<string, number> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const validated: Record<string, number> = {};
      for (const [key, val] of Object.entries(value)) {
        if (typeof key === 'string' && key.length > 0) {
          const numVal = typeof val === 'number' ? val : parseFloat(val?.toString() || '0');
          if (!isNaN(numVal) && numVal > 0) {
            validated[key] = numVal;
          }
        }
      }
      return Object.keys(validated).length > 0 ? validated : defaultValue;
    }
    return defaultValue;
  }

  static async validateConfigIntegrity(userId: string): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!userId || typeof userId !== 'string') {
      errors.push('Invalid user ID');
      return { isValid: false, errors };
    }

    try {
      const config = await this.getUserTradingConfig(userId);
      
      if (!config) {
        errors.push('No trading configuration found');
        return { isValid: false, errors };
      }

      if (!config.trading_pairs || config.trading_pairs.length === 0) {
        errors.push('At least one trading pair must be configured');
      }

      try {
        TypeConverter.toPercent(config.take_profit_percent, 'take_profit_percent');
      } catch (error) {
        errors.push(`Invalid take profit percentage: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      try {
        TypeConverter.toPercent(config.max_portfolio_exposure_percent, 'max_portfolio_exposure_percent');
      } catch (error) {
        errors.push(`Invalid portfolio exposure percentage: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      if (config.max_order_amount_usd > 50000) {
        errors.push('Maximum order amount seems very high (>$50,000)');
      }

      return { isValid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Failed to validate config: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, errors };
    }
  }
}
