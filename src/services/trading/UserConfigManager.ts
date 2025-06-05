
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class UserConfigManager {
  static async getUserTradingConfig(userId: string): Promise<TradingConfigData | null> {
    try {
      const { data: config, error } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching trading config:', error);
        return null;
      }

      if (!config) {
        console.error('No trading config found for user:', userId);
        return null;
      }

      // Convert database config to TradingConfigData format
      return {
        max_active_pairs: config.max_active_pairs || 5,
        max_order_amount_usd: config.max_order_amount_usd || 100,
        max_portfolio_exposure_percent: config.max_portfolio_exposure_percent || 25,
        daily_reset_time: config.daily_reset_time || '00:00:00',
        chart_timeframe: config.chart_timeframe || '4h',
        entry_offset_percent: config.entry_offset_percent || 0.5,
        take_profit_percent: config.take_profit_percent || 1.0,
        support_candle_count: config.support_candle_count || 128,
        max_positions_per_pair: config.max_positions_per_pair || 2,
        new_support_threshold_percent: config.new_support_threshold_percent || 2.0,
        trading_pairs: config.trading_pairs || ['BTCUSDT'],
        is_active: config.is_active || false,
        main_loop_interval_seconds: config.main_loop_interval_seconds || 30,
        auto_close_at_end_of_day: config.auto_close_at_end_of_day || false,
        eod_close_premium_percent: config.eod_close_premium_percent || 0.1,
        manual_close_premium_percent: config.manual_close_premium_percent || 0.1,
        support_lower_bound_percent: config.support_lower_bound_percent || 5.0,
        support_upper_bound_percent: config.support_upper_bound_percent || 2.0,
        minimum_notional_per_symbol: (config.minimum_notional_per_symbol as Record<string, number>) || { 'BTCUSDT': 10, 'ETHUSDT': 10 },
        quantity_increment_per_symbol: (config.quantity_increment_per_symbol as Record<string, number>) || { 'BTCUSDT': 0.00001, 'ETHUSDT': 0.0001 }
      };
    } catch (error) {
      console.error('Error in getUserTradingConfig:', error);
      return null;
    }
  }
}
