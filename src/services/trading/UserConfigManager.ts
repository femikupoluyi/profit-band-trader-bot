
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

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
        console.error('Error fetching trading config:', error);
        return null;
      }

      if (!config) {
        console.error('No trading config found for user:', userId);
        return null;
      }

      // Convert database config to TradingConfigData format with proper type casting and validation
      const tradingConfig: TradingConfigData = {
        max_active_pairs: this.validatePositiveInteger(config.max_active_pairs, 5),
        max_order_amount_usd: this.validatePositiveNumber(config.max_order_amount_usd, 100),
        max_portfolio_exposure_percent: this.validatePositiveNumber(config.max_portfolio_exposure_percent, 25),
        daily_reset_time: config.daily_reset_time || '00:00:00',
        chart_timeframe: this.validateChartTimeframe(config.chart_timeframe),
        entry_offset_percent: this.validatePositiveNumber(config.entry_offset_percent, 0.5),
        take_profit_percent: this.validatePositiveNumber(config.take_profit_percent, 1.0),
        support_candle_count: this.validatePositiveInteger(config.support_candle_count, 128),
        max_positions_per_pair: this.validatePositiveInteger(config.max_positions_per_pair, 2),
        new_support_threshold_percent: this.validatePositiveNumber(config.new_support_threshold_percent, 2.0),
        trading_pairs: this.validateTradingPairs(config.trading_pairs),
        is_active: Boolean(config.is_active),
        main_loop_interval_seconds: this.validatePositiveInteger(config.main_loop_interval_seconds, 30),
        auto_close_at_end_of_day: Boolean(config.auto_close_at_end_of_day),
        eod_close_premium_percent: this.validatePositiveNumber(config.eod_close_premium_percent, 0.1),
        manual_close_premium_percent: this.validatePositiveNumber(config.manual_close_premium_percent, 0.1),
        support_lower_bound_percent: this.validatePositiveNumber(config.support_lower_bound_percent, 5.0),
        support_upper_bound_percent: this.validatePositiveNumber(config.support_upper_bound_percent, 2.0),
        minimum_notional_per_symbol: this.validateJSONBObject(
          config.minimum_notional_per_symbol, 
          { 'BTCUSDT': 10, 'ETHUSDT': 10, 'SOLUSDT': 10, 'BNBUSDT': 10, 'LTCUSDT': 10, 'POLUSDT': 10, 'FETUSDT': 10, 'XRPUSDT': 10, 'XLMUSDT': 10 }
        ),
        quantity_increment_per_symbol: this.validateJSONBObject(
          config.quantity_increment_per_symbol, 
          { 'BTCUSDT': 0.00001, 'ETHUSDT': 0.0001, 'SOLUSDT': 0.01, 'BNBUSDT': 0.001, 'LTCUSDT': 0.01, 'POLUSDT': 1, 'FETUSDT': 1, 'XRPUSDT': 0.1, 'XLMUSDT': 1 }
        )
      };

      return tradingConfig;
    } catch (error) {
      console.error('Error in getUserTradingConfig:', error);
      return null;
    }
  }

  private static validatePositiveNumber(value: any, defaultValue: number): number {
    const num = parseFloat(value?.toString() || defaultValue.toString());
    return isNaN(num) || num <= 0 ? defaultValue : num;
  }

  private static validatePositiveInteger(value: any, defaultValue: number): number {
    const num = parseInt(value?.toString() || defaultValue.toString());
    return isNaN(num) || num <= 0 ? defaultValue : num;
  }

  private static validateChartTimeframe(timeframe: any): string {
    const validTimeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'];
    return validTimeframes.includes(timeframe) ? timeframe : '4h';
  }

  private static validateTradingPairs(pairs: any): string[] {
    const validPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 'POLUSDT', 'FETUSDT', 'XRPUSDT', 'XLMUSDT'];
    
    if (Array.isArray(pairs) && pairs.length > 0) {
      const filtered = pairs.filter(pair => typeof pair === 'string' && validPairs.includes(pair));
      return filtered.length > 0 ? filtered : ['BTCUSDT'];
    }
    return ['BTCUSDT'];
  }

  private static validateJSONBObject(value: any, defaultValue: Record<string, number>): Record<string, number> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Validate that all values are numbers
      const validated: Record<string, number> = {};
      for (const [key, val] of Object.entries(value)) {
        const numVal = parseFloat(val?.toString() || '0');
        if (!isNaN(numVal) && numVal > 0) {
          validated[key] = numVal;
        }
      }
      return Object.keys(validated).length > 0 ? validated : defaultValue;
    }
    return defaultValue;
  }
}
