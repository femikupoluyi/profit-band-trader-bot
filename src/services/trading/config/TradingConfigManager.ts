
import { supabase } from '@/integrations/supabase/client';

export interface TradingConfig {
  main_loop_interval_seconds: number;
  trading_pairs: string[];
  take_profit_percentage: number;
  entry_above_support_percentage: number;
  maximum_order_amount_usd: number;
  maximum_positions_per_pair: number;
  maximum_active_pairs: number;
  chart_timeframe: string;
  support_analysis_candles: number;
  support_lower_bound_percentage: number;
  support_upper_bound_percentage: number;
  minimum_notional_per_symbol: Record<string, number>;
  quantity_increment_per_symbol: Record<string, number>;
  manual_close_premium_percentage: number;
  auto_close_at_end_of_day: boolean;
  eod_close_premium_percentage: number;
  is_active: boolean;
}

export class TradingConfigManager {
  private static instances = new Map<string, TradingConfigManager>();
  private config: TradingConfig | null = null;
  private userId: string;

  private constructor(userId: string) {
    this.userId = userId;
  }

  static getInstance(userId: string): TradingConfigManager {
    if (!TradingConfigManager.instances.has(userId)) {
      TradingConfigManager.instances.set(userId, new TradingConfigManager(userId));
    }
    return TradingConfigManager.instances.get(userId)!;
  }

  async loadConfig(): Promise<TradingConfig> {
    try {
      console.log('🔄 Loading trading configuration...');
      
      const { data, error } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('No trading configuration found');

      this.config = {
        main_loop_interval_seconds: data.main_loop_interval_seconds || 30,
        trading_pairs: data.trading_pairs || ['BTCUSDT', 'ETHUSDT'],
        take_profit_percentage: data.take_profit_percent || 1.0,
        entry_above_support_percentage: data.entry_offset_percent || 0.5,
        maximum_order_amount_usd: data.max_order_amount_usd || 100,
        maximum_positions_per_pair: data.max_positions_per_pair || 2,
        maximum_active_pairs: data.max_active_pairs || 5,
        chart_timeframe: data.chart_timeframe || '4h',
        support_analysis_candles: data.support_candle_count || 128,
        support_lower_bound_percentage: data.support_lower_bound_percent || 5.0,
        support_upper_bound_percentage: data.support_upper_bound_percent || 2.0,
        minimum_notional_per_symbol: (typeof data.minimum_notional_per_symbol === 'object' && data.minimum_notional_per_symbol !== null) 
          ? data.minimum_notional_per_symbol as Record<string, number>
          : { 'BTCUSDT': 10, 'ETHUSDT': 10 },
        quantity_increment_per_symbol: (typeof data.quantity_increment_per_symbol === 'object' && data.quantity_increment_per_symbol !== null)
          ? data.quantity_increment_per_symbol as Record<string, number>
          : { 'BTCUSDT': 0.00001, 'ETHUSDT': 0.0001 },
        manual_close_premium_percentage: data.manual_close_premium_percent || 0.1,
        auto_close_at_end_of_day: data.auto_close_at_end_of_day || false,
        eod_close_premium_percentage: data.eod_close_premium_percent || 0.1,
        is_active: data.is_active || false
      };

      console.log('✅ Trading config loaded:', this.config);
      return this.config;
    } catch (error) {
      console.error('❌ Error loading trading config:', error);
      throw error;
    }
  }

  async refreshConfig(): Promise<TradingConfig> {
    return this.loadConfig();
  }

  getConfig(): TradingConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }
}
