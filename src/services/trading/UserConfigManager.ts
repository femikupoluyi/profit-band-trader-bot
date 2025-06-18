
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingPairsService } from './core/TradingPairsService';
import { TypeConverter } from './core/TypeConverter';

export class UserConfigManager {
  static async getUserTradingConfig(userId: string): Promise<TradingConfigData | null> {
    if (!userId || typeof userId !== 'string') {
      console.error('Invalid userId provided to getUserTradingConfig');
      return null;
    }

    try {
      const { data: config, error } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No trading config found for user:', userId);
          return null;
        }
        console.error('Error fetching trading config:', error);
        return null;
      }

      if (!config) {
        console.error('No trading config found for user:', userId);
        return null;
      }

      // Get configured trading pairs from the database - NO FALLBACKS
      const configuredTradingPairs = await TradingPairsService.getConfiguredTradingPairs(userId);
      
      // Convert database config to TradingConfigData format with proper type casting and validation
      const tradingConfig: TradingConfigData = {
        max_active_pairs: this.validatePositiveInteger(config.max_active_pairs, 5),
        max_order_amount_usd: TypeConverter.toNumberSafe(config.max_order_amount_usd, 100),
        max_portfolio_exposure_percent: TypeConverter.toNumberSafe(config.max_portfolio_exposure_percent, 25),
        daily_reset_time: this.validateAndNormalizeTime(config.daily_reset_time) || '00:00:00',
        chart_timeframe: this.validateChartTimeframe(config.chart_timeframe),
        entry_offset_percent: TypeConverter.toNumberSafe(config.entry_offset_percent, 0.5),
        take_profit_percent: TypeConverter.toNumberSafe(config.take_profit_percent, 1.0),
        support_candle_count: this.validatePositiveInteger(config.support_candle_count, 128),
        max_positions_per_pair: this.validatePositiveInteger(config.max_positions_per_pair, 2),
        new_support_threshold_percent: TypeConverter.toNumberSafe(config.new_support_threshold_percent, 2.0),
        trading_pairs: configuredTradingPairs, // Use exactly what's configured, no fallbacks
        is_active: Boolean(config.is_active),
        main_loop_interval_seconds: this.validateMainLoopInterval(config.main_loop_interval_seconds),
        auto_close_at_end_of_day: Boolean(config.auto_close_at_end_of_day),
        eod_close_premium_percent: TypeConverter.toNumberSafe(config.eod_close_premium_percent, 0.1),
        manual_close_premium_percent: TypeConverter.toNumberSafe(config.manual_close_premium_percent, 0.1),
        support_lower_bound_percent: TypeConverter.toNumberSafe(config.support_lower_bound_percent, 5.0),
        support_upper_bound_percent: TypeConverter.toNumberSafe(config.support_upper_bound_percent, 2.0),
        minimum_notional_per_symbol: TypeConverter.toJSONBObject<Record<string, number>>(
          config.minimum_notional_per_symbol
        ),
        quantity_increment_per_symbol: TypeConverter.toJSONBObject<Record<string, number>>(
          config.quantity_increment_per_symbol
        ),
        // Removed deprecated decimal fields - now handled dynamically by BybitInstrumentService
        price_decimals_per_symbol: {},
        quantity_decimals_per_symbol: {},
        max_concurrent_trades: this.validatePositiveInteger(config.max_active_pairs, 20),
        max_drawdown_percent: TypeConverter.toNumberSafe(config.max_drawdown_percent, 10.0),
        notes: config.notes || '',
        // New trading logic fields with safe property access and type conversion
        trading_logic_type: (config as any).trading_logic_type || 'logic1_base',
        swing_analysis_bars: this.validatePositiveInteger((config as any).swing_analysis_bars, 20),
        volume_lookback_periods: this.validatePositiveInteger((config as any).volume_lookback_periods, 50),
        fibonacci_sensitivity: TypeConverter.toNumberSafe((config as any).fibonacci_sensitivity, 0.618),
        atr_multiplier: TypeConverter.toNumberSafe((config as any).atr_multiplier, 1.0)
      };

      console.log(`✅ Loaded trading config for user ${userId} with ${tradingConfig.trading_pairs.length} trading pairs`);
      return tradingConfig;
    } catch (error) {
      console.error('Error in getUserTradingConfig:', error);
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
    
    // Accept HH:MM:SS format
    const timeRegexHHMMSS = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    if (timeRegexHHMMSS.test(timeStr)) {
      return timeStr;
    }
    
    // Accept HH:MM format and convert to HH:MM:SS
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

      // Enhanced validation with type checking
      if (!config.trading_pairs || config.trading_pairs.length === 0) {
        errors.push('At least one trading pair must be configured');
      }

      // Validate numeric ranges with proper type conversion
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

      // Validate order amount
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
