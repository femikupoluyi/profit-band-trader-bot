import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TradingConfigData, getDefaultConfig } from '../types/configTypes';
import { useConfigDatabase } from './useConfigDatabase';

export const useConfigDataLoader = (onConfigUpdate?: () => void) => {
  const { user } = useAuth();
  const [config, setConfig] = useState<TradingConfigData>(getDefaultConfig());
  const { isLoading, fetchConfig, saveConfig } = useConfigDatabase(onConfigUpdate);

  // Load config when the user changes
  useEffect(() => {
    if (user) {
      loadConfig();
    }
  }, [user]);

  const loadConfig = async () => {
    try {
      const data = await fetchConfig();
      if (data) {
        const loadedConfig: TradingConfigData = {
          max_active_pairs: data.max_active_pairs ?? 5,
          max_order_amount_usd: data.max_order_amount_usd ?? 100,
          max_portfolio_exposure_percent: data.max_portfolio_exposure_percent ?? 20,
          daily_reset_time: normalizeTimeFormat(data.daily_reset_time) ?? '00:00:00',
          chart_timeframe: data.chart_timeframe ?? '1h',
          entry_offset_percent: data.entry_offset_percent ?? 0.1,
          take_profit_percent: data.take_profit_percent ?? 2.0,
          support_candle_count: data.support_candle_count ?? 10,
          max_positions_per_pair: data.max_positions_per_pair ?? 1,
          new_support_threshold_percent: data.new_support_threshold_percent ?? 1.0,
          trading_pairs: Array.isArray(data.trading_pairs) && data.trading_pairs.length > 0 
            ? data.trading_pairs 
            : ['BTCUSDT', 'ETHUSDT'],
          is_active: Boolean(data.is_active),
          main_loop_interval_seconds: data.main_loop_interval_seconds ?? 300,
          auto_close_at_end_of_day: data.auto_close_at_end_of_day ?? true,
          eod_close_premium_percent: data.eod_close_premium_percent ?? 0.5,
          manual_close_premium_percent: data.manual_close_premium_percent ?? 0.3,
          support_lower_bound_percent: data.support_lower_bound_percent ?? 0.5,
          support_upper_bound_percent: data.support_upper_bound_percent ?? 2.0,
          minimum_notional_per_symbol: validateJsonObject(data.minimum_notional_per_symbol, {}),
          quantity_increment_per_symbol: validateJsonObject(data.quantity_increment_per_symbol, {}),
          price_decimals_per_symbol: validateJsonObject(data.price_decimals_per_symbol, {}),
          quantity_decimals_per_symbol: validateJsonObject(data.quantity_decimals_per_symbol, {}),
          max_concurrent_trades: data.max_active_pairs ?? 5,
          max_drawdown_percent: data.max_drawdown_percent ?? 10.0,
          notes: data.notes ?? '',
          // New trading logic fields with safe property access
          trading_logic_type: (data as any).trading_logic_type ?? 'logic1_base',
          swing_analysis_bars: (data as any).swing_analysis_bars ?? 20,
          volume_lookback_periods: (data as any).volume_lookback_periods ?? 50,
          fibonacci_sensitivity: (data as any).fibonacci_sensitivity ?? 0.618,
          atr_multiplier: (data as any).atr_multiplier ?? 1.0
        };
        
        console.log('Loaded config from database with validation:', loadedConfig);
        setConfig(loadedConfig);
      } else {
        console.log('No existing config found, using defaults:', getDefaultConfig());
        setConfig(getDefaultConfig());
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setConfig(getDefaultConfig());
    }
  };

  // Helper function to normalize time format
  const normalizeTimeFormat = (timeStr: any): string | null => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    
    // If it's already in HH:MM:SS format, keep it
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(timeStr)) {
      return timeStr;
    }
    
    // If it's in HH:MM format, add :00 seconds
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) {
      return timeStr + ':00';
    }
    
    return null;
  };

  // Validation helper functions
  const validateNumber = (value: any, defaultValue: number): number => {
    if (value === null || value === undefined) return defaultValue;
    const num = typeof value === 'number' ? value : parseFloat(value?.toString() || defaultValue.toString());
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
  };

  const validateInteger = (value: any, defaultValue: number): number => {
    if (value === null || value === undefined) return defaultValue;
    const num = typeof value === 'number' ? value : parseInt(value?.toString() || defaultValue.toString());
    return isNaN(num) || !isFinite(num) || !Number.isInteger(num) ? defaultValue : num;
  };

  const validateJsonObject = (value: any, defaultValue: Record<string, number>): Record<string, number> => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }
    return defaultValue;
  };

  return {
    config,
    setConfig,
    isLoading,
    saveConfig
  };
};
