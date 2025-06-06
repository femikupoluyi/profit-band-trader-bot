
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
    const data = await fetchConfig();
    if (data) {
      const loadedConfig: TradingConfigData = {
        max_active_pairs: data.max_active_pairs || 20,
        max_order_amount_usd: parseFloat(data.max_order_amount_usd?.toString() || '50'),
        max_portfolio_exposure_percent: parseFloat(data.max_portfolio_exposure_percent?.toString() || '20'),
        daily_reset_time: data.daily_reset_time || '00:00:00',
        chart_timeframe: data.chart_timeframe || '1m',
        entry_offset_percent: parseFloat(data.entry_offset_percent?.toString() || '0.5'),
        take_profit_percent: parseFloat(data.take_profit_percent?.toString() || '1.0'),
        support_candle_count: data.support_candle_count || 128,
        max_positions_per_pair: data.max_positions_per_pair || 2,
        new_support_threshold_percent: parseFloat(data.new_support_threshold_percent?.toString() || '1.0'),
        trading_pairs: data.trading_pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 'POLUSDT', 'FETUSDT', 'XRPUSDT', 'XLMUSDT'],
        is_active: data.is_active || false,
        main_loop_interval_seconds: data.main_loop_interval_seconds || 30,
        auto_close_at_end_of_day: data.auto_close_at_end_of_day || false,
        eod_close_premium_percent: parseFloat(data.eod_close_premium_percent?.toString() || '0.1'),
        manual_close_premium_percent: parseFloat(data.manual_close_premium_percent?.toString() || '0.1'),
        support_lower_bound_percent: parseFloat(data.support_lower_bound_percent?.toString() || '5.0'),
        support_upper_bound_percent: parseFloat(data.support_upper_bound_percent?.toString() || '2.0'),
        minimum_notional_per_symbol: (data.minimum_notional_per_symbol as Record<string, number>) || { 'BTCUSDT': 10, 'ETHUSDT': 10 },
        quantity_increment_per_symbol: (data.quantity_increment_per_symbol as Record<string, number>) || { 'BTCUSDT': 0.00001, 'ETHUSDT': 0.0001 },
        price_decimals_per_symbol: (data.price_decimals_per_symbol as Record<string, number>) || {},
        quantity_decimals_per_symbol: (data.quantity_decimals_per_symbol as Record<string, number>) || {},
        // Use max_active_pairs for max_concurrent_trades for consistency
        max_concurrent_trades: data.max_active_pairs || 20,
        max_drawdown_percent: parseFloat(data.max_drawdown_percent?.toString() || '10.0'),
        notes: data.notes || ''
      };
      
      console.log('Loaded config from database with all fields:', loadedConfig);
      setConfig(loadedConfig);
    } else {
      console.log('No existing config found, using defaults:', getDefaultConfig());
      setConfig(getDefaultConfig());
    }
  };

  return {
    config,
    setConfig,
    isLoading,
    saveConfig
  };
};
