
import { TradingConfig } from '../config/TradingConfigManager';
import { TradingConfigData } from '@/components/trading/config/types/configTypes';

export class ConfigConverter {
  static convertConfig(config: TradingConfig): TradingConfigData {
    return {
      max_active_pairs: config.maximum_active_pairs,
      max_order_amount_usd: config.maximum_order_amount_usd,
      max_portfolio_exposure_percent: 20.0, // Fixed default - not configurable
      daily_reset_time: '00:00:00', // Fixed default - not configurable
      chart_timeframe: config.chart_timeframe,
      entry_offset_percent: config.entry_above_support_percentage,
      take_profit_percent: config.take_profit_percentage,
      support_candle_count: config.support_analysis_candles,
      max_positions_per_pair: config.maximum_positions_per_pair,
      new_support_threshold_percent: 1.0, // Fixed default - not configurable
      trading_pairs: Array.isArray(config.trading_pairs) && config.trading_pairs.length > 0 
        ? config.trading_pairs 
        : [],
      is_active: Boolean(config.is_active),
      main_loop_interval_seconds: config.main_loop_interval_seconds,
      auto_close_at_end_of_day: Boolean(config.auto_close_at_end_of_day),
      eod_close_premium_percent: config.eod_close_premium_percentage,
      manual_close_premium_percent: config.manual_close_premium_percentage,
      support_lower_bound_percent: config.support_lower_bound_percentage,
      support_upper_bound_percent: config.support_upper_bound_percentage,
      minimum_notional_per_symbol: config.minimum_notional_per_symbol || {},
      quantity_increment_per_symbol: config.quantity_increment_per_symbol || {},
      price_decimals_per_symbol: {},
      quantity_decimals_per_symbol: {},
      max_concurrent_trades: config.maximum_active_pairs,
      max_drawdown_percent: 10.0, // Fixed default - not configurable
      notes: '',
      // New trading logic defaults
      trading_logic_type: 'logic1_base',
      swing_analysis_bars: 20,
      volume_lookback_periods: 50,
      fibonacci_sensitivity: 0.618,
      atr_multiplier: 1.0
    };
  }
}
