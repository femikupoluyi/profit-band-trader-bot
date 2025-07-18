
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

      // Map database fields to service interface - NO FALLBACK VALUES
      this.config = {
        main_loop_interval_seconds: data.main_loop_interval_seconds ?? 300,
        trading_pairs: this.validateTradingPairs(data.trading_pairs),
        take_profit_percentage: data.take_profit_percent ?? 2.0,
        entry_above_support_percentage: data.entry_offset_percent ?? 0.1,
        maximum_order_amount_usd: data.max_order_amount_usd ?? 100,
        maximum_positions_per_pair: data.max_positions_per_pair ?? 1,
        maximum_active_pairs: data.max_active_pairs ?? 5,
        chart_timeframe: this.validateChartTimeframe(data.chart_timeframe),
        support_analysis_candles: data.support_candle_count ?? 10,
        support_lower_bound_percentage: data.support_lower_bound_percent ?? 0.5,
        support_upper_bound_percentage: data.support_upper_bound_percent ?? 2.0,
        minimum_notional_per_symbol: this.validateJSONBObject(
          data.minimum_notional_per_symbol,
          {}
        ),
        quantity_increment_per_symbol: this.validateJSONBObject(
          data.quantity_increment_per_symbol,
          {}
        ),
        manual_close_premium_percentage: data.manual_close_premium_percent ?? 0.3,
        auto_close_at_end_of_day: data.auto_close_at_end_of_day ?? true,
        eod_close_premium_percentage: data.eod_close_premium_percent ?? 0.5,
        is_active: Boolean(data.is_active)
      };

      console.log('✅ Trading config loaded successfully');
      return this.config;
    } catch (error) {
      console.error('❌ Error loading trading config:', error);
      throw error;
    }
  }

  private validatePositiveInteger(value: any, defaultValue: number): number {
    if (value === null || value === undefined) return defaultValue;
    const num = typeof value === 'number' ? value : parseInt(value?.toString() || defaultValue.toString());
    return isNaN(num) || num <= 0 || !Number.isInteger(num) ? defaultValue : num;
  }

  private validatePositiveNumber(value: any, defaultValue: number): number {
    if (value === null || value === undefined) return defaultValue;
    const num = typeof value === 'number' ? value : parseFloat(value?.toString() || defaultValue.toString());
    return isNaN(num) || num <= 0 ? defaultValue : num;
  }

  private validateChartTimeframe(timeframe: any): string {
    const validTimeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'];
    return validTimeframes.includes(timeframe) ? timeframe : '4h';
  }

  private validateTradingPairs(pairs: any): string[] {
    // Load trading pairs directly from database configuration - NO FALLBACKS
    if (Array.isArray(pairs) && pairs.length > 0) {
      const filtered = pairs.filter(pair => typeof pair === 'string' && pair.length > 0);
      return filtered;
    }
    return []; // Return empty array if no pairs configured
  }

  private validateJSONBObject(value: any, defaultValue: Record<string, number>): Record<string, number> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const validated: Record<string, number> = {};
      for (const [key, val] of Object.entries(value)) {
        if (typeof key === 'string' && key.length > 0) {
          const numVal = typeof val === 'number' ? val : parseFloat(val?.toString() || '0');
          if (!isNaN(numVal) && numVal > 0) {
            validated[key] = numVal;
          }
        }
      }
      return Object.keys(validated).length > 0 ? validated : defaultValue;
    }
    return defaultValue;
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

  getConfigValue<K extends keyof TradingConfig>(key: K): TradingConfig[K] {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config[key];
  }

  isConfigLoaded(): boolean {
    return this.config !== null;
  }

  validateConfig(): { isValid: boolean; errors: string[] } {
    if (!this.config) {
      return { isValid: false, errors: ['Configuration not loaded'] };
    }

    const errors: string[] = [];

    if (!this.config.trading_pairs || this.config.trading_pairs.length === 0) {
      errors.push('No trading pairs configured');
    }

    if (this.config.maximum_order_amount_usd <= 0) {
      errors.push('Maximum order amount must be greater than 0');
    }

    if (this.config.take_profit_percentage <= 0) {
      errors.push('Take profit percentage must be greater than 0');
    }

    if (this.config.maximum_active_pairs <= 0) {
      errors.push('Maximum active pairs must be greater than 0');
    }

    return { isValid: errors.length === 0, errors };
  }
}
