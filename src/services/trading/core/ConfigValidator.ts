
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { VALID_CHART_TIMEFRAMES, ChartTimeframe } from './TypeDefinitions';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigValidator {
  static validateTradingConfig(config: TradingConfigData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validations
    if (!config.trading_pairs || config.trading_pairs.length === 0) {
      errors.push('At least one trading pair must be selected');
    }

    if (!config.max_order_amount_usd || config.max_order_amount_usd <= 0) {
      errors.push('Maximum order amount must be greater than 0');
    }

    if (!config.take_profit_percent || config.take_profit_percent <= 0) {
      errors.push('Take profit percentage must be greater than 0');
    }

    if (!config.max_active_pairs || config.max_active_pairs <= 0) {
      errors.push('Maximum active pairs must be greater than 0');
    }

    if (!config.support_candle_count || config.support_candle_count <= 0) {
      errors.push('Support candle count must be greater than 0');
    }

    // Range validations
    if (config.max_portfolio_exposure_percent && (config.max_portfolio_exposure_percent <= 0 || config.max_portfolio_exposure_percent > 100)) {
      errors.push('Portfolio exposure percentage must be between 0 and 100');
    }

    if (config.entry_offset_percent && (config.entry_offset_percent < 0 || config.entry_offset_percent > 10)) {
      errors.push('Entry offset percentage must be between 0 and 10');
    }

    if (config.take_profit_percent && config.take_profit_percent > 50) {
      warnings.push('Take profit percentage above 50% may be too aggressive');
    }

    if (config.support_lower_bound_percent && (config.support_lower_bound_percent < 0 || config.support_lower_bound_percent > 20)) {
      errors.push('Support lower bound percentage must be between 0 and 20');
    }

    if (config.support_upper_bound_percent && (config.support_upper_bound_percent < 0 || config.support_upper_bound_percent > 10)) {
      errors.push('Support upper bound percentage must be between 0 and 10');
    }

    if (config.new_support_threshold_percent && (config.new_support_threshold_percent < 0 || config.new_support_threshold_percent > 10)) {
      errors.push('New support threshold percentage must be between 0 and 10');
    }

    // Chart timeframe validation
    if (config.chart_timeframe && !VALID_CHART_TIMEFRAMES.includes(config.chart_timeframe as ChartTimeframe)) {
      errors.push(`Invalid chart timeframe. Must be one of: ${VALID_CHART_TIMEFRAMES.join(', ')}`);
    }

    // Loop interval validation
    if (config.main_loop_interval_seconds && config.main_loop_interval_seconds < 10) {
      warnings.push('Main loop interval less than 10 seconds may cause high API usage');
    }

    if (config.main_loop_interval_seconds && config.main_loop_interval_seconds > 300) {
      warnings.push('Main loop interval greater than 5 minutes may miss trading opportunities');
    }

    // Trading pairs validation
    if (config.trading_pairs && config.trading_pairs.length > 20) {
      warnings.push('More than 20 trading pairs may cause performance issues');
    }

    // Active pairs vs trading pairs validation
    if (config.max_active_pairs && config.trading_pairs && config.max_active_pairs > config.trading_pairs.length) {
      warnings.push('Maximum active pairs should not exceed the number of available trading pairs');
    }

    // Premium percentages validation
    if (config.manual_close_premium_percent && (config.manual_close_premium_percent < 0 || config.manual_close_premium_percent > 5)) {
      errors.push('Manual close premium percentage must be between 0 and 5');
    }

    if (config.eod_close_premium_percent && (config.eod_close_premium_percent < 0 || config.eod_close_premium_percent > 5)) {
      errors.push('EOD close premium percentage must be between 0 and 5');
    }

    // Position limits validation
    if (config.max_positions_per_pair && (config.max_positions_per_pair <= 0 || config.max_positions_per_pair > 10)) {
      errors.push('Maximum positions per pair must be between 1 and 10');
    }

    // Daily reset time validation (FIXED) - now accepts both HH:MM and HH:MM:SS formats
    if (config.daily_reset_time) {
      // Accept both HH:MM and HH:MM:SS formats
      const timeRegexHHMM = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      const timeRegexHHMMSS = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
      
      if (!timeRegexHHMM.test(config.daily_reset_time) && !timeRegexHHMMSS.test(config.daily_reset_time)) {
        errors.push('Daily reset time must be in HH:MM or HH:MM:SS format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateTradingPairs(config: TradingConfigData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.trading_pairs) {
      for (const pair of config.trading_pairs) {
        // Basic symbol validation
        if (!pair || pair.length < 3) {
          errors.push(`Invalid trading pair: ${pair}`);
        }
        
        // Check if it's a USDT pair (most common for spot trading)
        if (!pair.endsWith('USDT')) {
          warnings.push(`Trading pair ${pair} is not a USDT pair, ensure it's supported`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateRiskParameters(config: TradingConfigData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate risk management parameters
    if (config.max_order_amount_usd && config.max_portfolio_exposure_percent) {
      const maxExposure = config.max_order_amount_usd * config.max_active_pairs;
      if (maxExposure > 10000) { // Arbitrary high limit for demo trading
        warnings.push(`Total potential exposure (${maxExposure} USD) may be too high for demo trading`);
      }
    }

    // Validate profit/loss ratios
    if (config.take_profit_percent && config.entry_offset_percent) {
      const ratio = config.take_profit_percent / config.entry_offset_percent;
      if (ratio < 2) {
        warnings.push('Take profit to entry offset ratio is less than 2:1, consider increasing take profit');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
