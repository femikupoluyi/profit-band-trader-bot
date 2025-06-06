
import { TradingConfig } from '../config/TradingConfigManager';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class ConfigConverter {
  static convertConfig(config: TradingConfig): TradingConfigData {
    return {
      max_active_pairs: config.maximum_active_pairs || 5,
      max_order_amount_usd: config.maximum_order_amount_usd || 100.0,
      max_portfolio_exposure_percent: 25.0,
      daily_reset_time: '00:00:00',
      chart_timeframe: config.chart_timeframe || '4h',
      entry_offset_percent: config.entry_above_support_percentage || 0.5,
      take_profit_percent: config.take_profit_percentage || 1.0,
      support_candle_count: config.support_analysis_candles || 128,
      max_positions_per_pair: config.maximum_positions_per_pair || 2,
      new_support_threshold_percent: 2.0,
      trading_pairs: Array.isArray(config.trading_pairs) && config.trading_pairs.length > 0 
        ? config.trading_pairs 
        : ['BTCUSDT', 'ETHUSDT'],
      is_active: Boolean(config.is_active),
      main_loop_interval_seconds: config.main_loop_interval_seconds || 30,
      auto_close_at_end_of_day: Boolean(config.auto_close_at_end_of_day),
      eod_close_premium_percent: config.eod_close_premium_percentage || 0.1,
      manual_close_premium_percent: config.manual_close_premium_percentage || 0.1,
      support_lower_bound_percent: config.support_lower_bound_percentage || 5.0,
      support_upper_bound_percent: config.support_upper_bound_percentage || 2.0,
      minimum_notional_per_symbol: {
        'BTCUSDT': 10, 'ETHUSDT': 10, 'SOLUSDT': 10, 'BNBUSDT': 10, 'LTCUSDT': 10,
        'POLUSDT': 10, 'FETUSDT': 10, 'XRPUSDT': 10, 'XLMUSDT': 10
      },
      quantity_increment_per_symbol: {
        'BTCUSDT': 0.00001, 'ETHUSDT': 0.0001, 'SOLUSDT': 0.01, 'BNBUSDT': 0.001, 'LTCUSDT': 0.01,
        'POLUSDT': 1, 'FETUSDT': 1, 'XRPUSDT': 0.1, 'XLMUSDT': 1
      },
      price_decimals_per_symbol: {},
      quantity_decimals_per_symbol: {},
      // Use maximum_active_pairs for max_concurrent_trades to maintain consistency
      max_concurrent_trades: config.maximum_active_pairs || 20,
      // Use default value instead of non-existent property
      max_drawdown_percent: 10.0,
      // Use default value instead of non-existent property
      notes: ''
    };
  }
}
