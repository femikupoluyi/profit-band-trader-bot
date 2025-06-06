
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
          max_active_pairs: validateInteger(data.max_active_pairs, 20),
          max_order_amount_usd: validateNumber(data.max_order_amount_usd, 50),
          max_portfolio_exposure_percent: validateNumber(data.max_portfolio_exposure_percent, 20),
          daily_reset_time: data.daily_reset_time || '00:00:00',
          chart_timeframe: data.chart_timeframe || '1m',
          entry_offset_percent: validateNumber(data.entry_offset_percent, 0.5),
          take_profit_percent: validateNumber(data.take_profit_percent, 1.0),
          support_candle_count: validateInteger(data.support_candle_count, 128),
          max_positions_per_pair: validateInteger(data.max_positions_per_pair, 2),
          new_support_threshold_percent: validateNumber(data.new_support_threshold_percent, 1.0),
          trading_pairs: Array.isArray(data.trading_pairs) ? data.trading_pairs : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 'POLUSDT', 'FETUSDT', 'XRPUSDT', 'XLMUSDT'],
          is_active: Boolean(data.is_active),
          main_loop_interval_seconds: validateInteger(data.main_loop_interval_seconds, 30),
          auto_close_at_end_of_day: Boolean(data.auto_close_at_end_of_day),
          eod_close_premium_percent: validateNumber(data.eod_close_premium_percent, 0.1),
          manual_close_premium_percent: validateNumber(data.manual_close_premium_percent, 0.1),
          support_lower_bound_percent: validateNumber(data.support_lower_bound_percent, 5.0),
          support_upper_bound_percent: validateNumber(data.support_upper_bound_percent, 2.0),
          minimum_notional_per_symbol: validateJsonObject(data.minimum_notional_per_symbol, { 'BTCUSDT': 10, 'ETHUSDT': 10 }),
          quantity_increment_per_symbol: validateJsonObject(data.quantity_increment_per_symbol, { 'BTCUSDT': 0.00001, 'ETHUSDT': 0.0001 }),
          price_decimals_per_symbol: validateJsonObject(data.price_decimals_per_symbol, {}),
          quantity_decimals_per_symbol: validateJsonObject(data.quantity_decimals_per_symbol, {}),
          max_concurrent_trades: validateInteger(data.max_active_pairs, 20),
          max_drawdown_percent: validateNumber(data.max_drawdown_percent, 10.0),
          notes: data.notes || ''
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
