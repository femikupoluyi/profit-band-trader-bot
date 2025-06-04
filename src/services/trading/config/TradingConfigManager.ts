
import { supabase } from '@/integrations/supabase/client';

export interface TradingConfig {
  // Core Loop Configuration
  main_loop_interval_seconds: number;
  trading_pairs: string[];
  
  // Trading Parameters
  take_profit_percentage: number;
  entry_above_support_percentage: number;
  maximum_order_amount_usd: number;
  maximum_positions_per_pair: number;
  maximum_active_pairs: number;
  
  // Technical Analysis
  chart_timeframe: string;
  support_analysis_candles: number;
  support_lower_bound_percentage: number;
  support_upper_bound_percentage: number;
  
  // Exchange Limits
  minimum_notional_per_symbol: Record<string, number>;
  quantity_increment_per_symbol: Record<string, number>;
  
  // Manual Operations
  manual_close_premium_percentage: number;
  
  // End of Day Management
  auto_close_at_end_of_day: boolean;
  eod_close_premium_percentage: number;
  
  // System State
  is_active: boolean;
}

export class TradingConfigManager {
  private static instance: TradingConfigManager;
  private config: TradingConfig | null = null;
  private userId: string;

  private constructor(userId: string) {
    this.userId = userId;
  }

  static getInstance(userId: string): TradingConfigManager {
    if (!TradingConfigManager.instance || TradingConfigManager.instance.userId !== userId) {
      TradingConfigManager.instance = new TradingConfigManager(userId);
    }
    return TradingConfigManager.instance;
  }

  async loadConfig(): Promise<TradingConfig> {
    try {
      const { data, error } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (error) throw error;

      this.config = {
        main_loop_interval_seconds: data.main_loop_interval_seconds || 30,
        trading_pairs: data.trading_pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
        take_profit_percentage: data.take_profit_percent || 2.0,
        entry_above_support_percentage: data.entry_offset_percent || 0.5,
        maximum_order_amount_usd: data.max_order_amount_usd || 50.0,
        maximum_positions_per_pair: data.max_positions_per_pair || 2,
        maximum_active_pairs: data.max_active_pairs || 5,
        chart_timeframe: data.chart_timeframe || '5m',
        support_analysis_candles: data.support_candle_count || 20,
        support_lower_bound_percentage: data.support_lower_bound_percent || 5.0,
        support_upper_bound_percentage: data.support_upper_bound_percent || 2.0,
        minimum_notional_per_symbol: data.minimum_notional_per_symbol || {},
        quantity_increment_per_symbol: data.quantity_increment_per_symbol || {},
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

  getConfig(): TradingConfig {
    if (!this.config) {
      throw new Error('Config not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  async refreshConfig(): Promise<TradingConfig> {
    return await this.loadConfig();
  }
}
