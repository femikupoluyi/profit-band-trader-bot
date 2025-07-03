
export interface TradingConfigData {
  max_active_pairs: number;
  max_order_amount_usd: number;
  max_portfolio_exposure_percent: number;
  daily_reset_time: string;
  chart_timeframe: string;
  entry_offset_percent: number;
  take_profit_percent: number;
  support_candle_count: number;
  max_positions_per_pair: number;
  new_support_threshold_percent: number;
  trading_pairs: string[];
  is_active: boolean;
  main_loop_interval_seconds: number;
  auto_close_at_end_of_day: boolean;
  eod_close_premium_percent: number;
  manual_close_premium_percent: number;
  support_lower_bound_percent: number;
  support_upper_bound_percent: number;
  minimum_notional_per_symbol: Record<string, number>;
  quantity_increment_per_symbol: Record<string, number>;
  price_decimals_per_symbol: Record<string, number>;
  quantity_decimals_per_symbol: Record<string, number>;
  max_concurrent_trades: number;
  max_drawdown_percent: number;
  notes: string;
  // New trading logic configuration
  trading_logic_type: 'logic1_base' | 'logic2_data_driven';
  swing_analysis_bars: number;
  volume_lookback_periods: number;
  fibonacci_sensitivity: number;
  atr_multiplier: number;
}

export const getDefaultConfig = (): TradingConfigData => ({
  max_active_pairs: 5,
  max_order_amount_usd: 100.0,
  max_portfolio_exposure_percent: 20.0,
  daily_reset_time: '00:00:00',
  chart_timeframe: '4h',
  entry_offset_percent: 0.1,
  take_profit_percent: 2.0,
  support_candle_count: 10,
  max_positions_per_pair: 1,
  new_support_threshold_percent: 1.0,
  trading_pairs: ['BTCUSDT', 'ETHUSDT'],
  is_active: false,
  main_loop_interval_seconds: 300,
  auto_close_at_end_of_day: true,
  eod_close_premium_percent: 0.5,
  manual_close_premium_percent: 0.3,
  support_lower_bound_percent: 0.5,
  support_upper_bound_percent: 2.0,
  minimum_notional_per_symbol: {},
  quantity_increment_per_symbol: {},
  price_decimals_per_symbol: {},
  quantity_decimals_per_symbol: {},
  max_concurrent_trades: 5,
  max_drawdown_percent: 10.0,
  notes: '',
  // New trading logic defaults
  trading_logic_type: 'logic1_base',
  swing_analysis_bars: 20,
  volume_lookback_periods: 50,
  fibonacci_sensitivity: 0.618,
  atr_multiplier: 1.0
});
