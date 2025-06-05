
import { Database } from '@/integrations/supabase/types';

type TradingConfig = Database['public']['Tables']['trading_configs']['Row'];

export class ConfigValidator {
  static validateConfig(config: TradingConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate numeric ranges
    if (config.max_order_amount_usd && config.max_order_amount_usd <= 0) {
      errors.push('Max order amount must be greater than 0');
    }

    if (config.max_portfolio_exposure_percent && (config.max_portfolio_exposure_percent <= 0 || config.max_portfolio_exposure_percent > 100)) {
      errors.push('Max portfolio exposure must be between 0 and 100');
    }

    if (config.take_profit_percent && config.take_profit_percent <= 0) {
      errors.push('Take profit percent must be greater than 0');
    }

    if (config.entry_offset_percent && config.entry_offset_percent < 0) {
      errors.push('Entry offset percent cannot be negative');
    }

    if (config.support_lower_bound_percent && config.support_upper_bound_percent) {
      if (config.support_lower_bound_percent >= config.support_upper_bound_percent) {
        errors.push('Support lower bound must be less than upper bound');
      }
    }

    // Validate integers
    if (config.max_active_pairs && config.max_active_pairs <= 0) {
      errors.push('Max active pairs must be greater than 0');
    }

    if (config.support_candle_count && config.support_candle_count <= 0) {
      errors.push('Support candle count must be greater than 0');
    }

    if (config.main_loop_interval_seconds && config.main_loop_interval_seconds < 10) {
      errors.push('Main loop interval must be at least 10 seconds');
    }

    // Validate arrays
    if (config.trading_pairs && config.trading_pairs.length === 0) {
      errors.push('At least one trading pair must be selected');
    }

    // Validate chart timeframe
    const validTimeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'];
    if (config.chart_timeframe && !validTimeframes.includes(config.chart_timeframe)) {
      errors.push(`Chart timeframe must be one of: ${validTimeframes.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static getDefaultConfig(userId: string): Partial<TradingConfig> {
    return {
      user_id: userId,
      is_active: false,
      max_active_pairs: 5,
      max_order_amount_usd: 100,
      max_portfolio_exposure_percent: 25,
      take_profit_percent: 1.0,
      entry_offset_percent: 0.5,
      support_lower_bound_percent: 5.0,
      support_upper_bound_percent: 2.0,
      support_candle_count: 128,
      max_positions_per_pair: 2,
      new_support_threshold_percent: 2.0,
      main_loop_interval_seconds: 30,
      chart_timeframe: '4h',
      auto_close_at_end_of_day: false,
      eod_close_premium_percent: 0.1,
      manual_close_premium_percent: 0.1,
      daily_reset_time: '00:00:00',
      trading_pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT'],
      minimum_notional_per_symbol: {
        'BTCUSDT': 10,
        'ETHUSDT': 10,
        'SOLUSDT': 10,
        'BNBUSDT': 10,
        'LTCUSDT': 10
      },
      quantity_increment_per_symbol: {
        'BTCUSDT': 0.00001,
        'ETHUSDT': 0.0001,
        'SOLUSDT': 0.01,
        'BNBUSDT': 0.001,
        'LTCUSDT': 0.01
      }
    };
  }
}
