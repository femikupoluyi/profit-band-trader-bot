
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class ConfigurationService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async loadUserConfig(): Promise<TradingConfigData | null> {
    try {
      console.log(`🔧 CRITICAL: Loading configuration for user: ${this.userId}`);
      
      const { data: config, error } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', this.userId)
        .single(); // Use single() instead of maybeSingle() to ensure we get the config

      if (error) {
        console.error('❌ CRITICAL: Error loading configuration:', error);
        console.error('❌ This will cause the system to use default values instead of user config!');
        return null;
      }

      if (!config) {
        console.error('❌ CRITICAL: No configuration found for user - this should not happen!');
        return null;
      }

      console.log(`✅ Configuration loaded successfully:`, {
        isActive: config.is_active,
        tradingPairs: config.trading_pairs?.length || 0,
        maxOrderAmount: config.max_order_amount_usd,
        maxPositionsPerPair: config.max_positions_per_pair
      });

      // Helper function to safely convert JSONB to Record<string, number>
      const safeConvertToRecord = (value: any): Record<string, number> => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const result: Record<string, number> = {};
          for (const [key, val] of Object.entries(value)) {
            if (typeof key === 'string' && (typeof val === 'number' || typeof val === 'string')) {
              const numVal = typeof val === 'number' ? val : parseFloat(val.toString());
              if (!isNaN(numVal)) {
                result[key] = numVal;
              }
            }
          }
          return result;
        }
        return {};
      };

      // Helper function to safely convert trading logic type
      const safeTradingLogicType = (value: any): 'logic1_base' | 'logic2_data_driven' => {
        if (value === 'logic2_data_driven') return 'logic2_data_driven';
        return 'logic1_base';
      };

      // Map database config to TradingConfigData format - RESPECT DATABASE VALUES
      const tradingConfig: TradingConfigData = {
        max_active_pairs: config.max_active_pairs ?? 5,
        max_order_amount_usd: config.max_order_amount_usd ?? 100,
        max_portfolio_exposure_percent: config.max_portfolio_exposure_percent ?? 20,
        daily_reset_time: config.daily_reset_time ?? '00:00:00',
        chart_timeframe: config.chart_timeframe ?? '1h',
        entry_offset_percent: config.entry_offset_percent ?? 0.1,
        take_profit_percent: config.take_profit_percent ?? 2.0,
        support_candle_count: config.support_candle_count ?? 10,
        max_positions_per_pair: config.max_positions_per_pair ?? 1,
        new_support_threshold_percent: config.new_support_threshold_percent ?? 1.0,
        trading_pairs: Array.isArray(config.trading_pairs) && config.trading_pairs.length > 0 
          ? config.trading_pairs 
          : ['BTCUSDT', 'ETHUSDT'],
        is_active: Boolean(config.is_active),
        main_loop_interval_seconds: config.main_loop_interval_seconds ?? 300,
        auto_close_at_end_of_day: config.auto_close_at_end_of_day ?? true,
        eod_close_premium_percent: config.eod_close_premium_percent ?? 0.5,
        manual_close_premium_percent: config.manual_close_premium_percent ?? 0.3,
        support_lower_bound_percent: config.support_lower_bound_percent ?? 0.5,
        support_upper_bound_percent: config.support_upper_bound_percent ?? 2.0,
        minimum_notional_per_symbol: safeConvertToRecord(config.minimum_notional_per_symbol),
        quantity_increment_per_symbol: safeConvertToRecord(config.quantity_increment_per_symbol),
        price_decimals_per_symbol: safeConvertToRecord(config.price_decimals_per_symbol),
        quantity_decimals_per_symbol: safeConvertToRecord(config.quantity_decimals_per_symbol),
        max_concurrent_trades: config.max_active_pairs ?? 5,
        max_drawdown_percent: config.max_drawdown_percent ?? 10.0,
        notes: config.notes ?? '',
        trading_logic_type: safeTradingLogicType(config.trading_logic_type),
        swing_analysis_bars: config.swing_analysis_bars ?? 20,
        volume_lookback_periods: config.volume_lookback_periods ?? 50,
        fibonacci_sensitivity: config.fibonacci_sensitivity ?? 0.618,
        atr_multiplier: config.atr_multiplier ?? 1.0
      };

      return tradingConfig;
    } catch (error) {
      console.error('❌ Critical error loading configuration:', error);
      return null;
    }
  }

  async validateConfigurationAccess(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('trading_configs')
        .select('id')
        .eq('user_id', this.userId)
        .limit(1);

      if (error) {
        console.error('❌ Configuration access validation failed:', error);
        return false;
      }

      console.log(`✅ Configuration access validated for user: ${this.userId}`);
      return true;
    } catch (error) {
      console.error('❌ Error validating configuration access:', error);
      return false;
    }
  }
}
