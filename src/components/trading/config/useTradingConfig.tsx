import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TradingConfigData {
  max_active_pairs: number;
  max_order_amount_usd: number;
  max_portfolio_exposure_percent: number;
  daily_reset_time: string;
  chart_timeframe: string;
  entry_offset_percent: number;
  take_profit_percent: number;
  support_candle_count: number;
  max_positions_per_pair: number;
  new_support_threshold_percent: number;
  trading_pairs: string[];
  is_active: boolean;
  main_loop_interval_seconds: number;
  auto_close_at_end_of_day: boolean;
  eod_close_premium_percent: number;
  manual_close_premium_percent: number;
  support_lower_bound_percent: number;
  support_upper_bound_percent: number;
  minimum_notional_per_symbol: Record<string, number>;
  quantity_increment_per_symbol: Record<string, number>;
  price_decimals_per_symbol?: Record<string, number>;
  quantity_decimals_per_symbol?: Record<string, number>;
}

const getDefaultConfig = (): TradingConfigData => ({
  max_active_pairs: 20,
  max_order_amount_usd: 50.0,
  max_portfolio_exposure_percent: 20.0,
  daily_reset_time: '00:00:00',
  chart_timeframe: '1m',
  entry_offset_percent: 0.5,
  take_profit_percent: 1.0,
  support_candle_count: 128,
  max_positions_per_pair: 2,
  new_support_threshold_percent: 1.0,
  trading_pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 'POLUSDT', 'FETUSDT', 'XRPUSDT', 'XLMUSDT'],
  is_active: false,
  main_loop_interval_seconds: 30,
  auto_close_at_end_of_day: false,
  eod_close_premium_percent: 0.1,
  manual_close_premium_percent: 0.1,
  support_lower_bound_percent: 5.0,
  support_upper_bound_percent: 2.0,
  minimum_notional_per_symbol: { 'BTCUSDT': 10, 'ETHUSDT': 10 },
  quantity_increment_per_symbol: { 'BTCUSDT': 0.00001, 'ETHUSDT': 0.0001 }
});

export const useTradingConfig = (onConfigUpdate?: () => void) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [config, setConfig] = useState<TradingConfigData>(getDefaultConfig());

  useEffect(() => {
    if (user) {
      fetchConfig();
    }
  }, [user]);

  const fetchConfig = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setHasExistingConfig(true);
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
          price_decimals_per_symbol: (data.price_decimals_per_symbol as Record<string, number>) || { 'BTCUSDT': 8, 'ETHUSDT': 8 },
          quantity_decimals_per_symbol: (data.quantity_decimals_per_symbol as Record<string, number>) || { 'BTCUSDT': 8, 'ETHUSDT': 8 }
        };
        
        console.log('Loaded config from database with all fields:', loadedConfig);
        setConfig(loadedConfig);
      } else {
        setHasExistingConfig(false);
        console.log('No existing config found, using defaults:', getDefaultConfig());
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      toast({
        title: "Error",
        description: "Failed to load trading configuration.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const configData = {
        max_active_pairs: config.max_active_pairs,
        max_order_amount_usd: config.max_order_amount_usd,
        max_portfolio_exposure_percent: config.max_portfolio_exposure_percent,
        daily_reset_time: config.daily_reset_time,
        chart_timeframe: config.chart_timeframe,
        entry_offset_percent: config.entry_offset_percent,
        take_profit_percent: config.take_profit_percent,
        support_candle_count: config.support_candle_count,
        max_positions_per_pair: config.max_positions_per_pair,
        new_support_threshold_percent: config.new_support_threshold_percent,
        trading_pairs: config.trading_pairs,
        is_active: config.is_active,
        main_loop_interval_seconds: config.main_loop_interval_seconds,
        auto_close_at_end_of_day: config.auto_close_at_end_of_day,
        eod_close_premium_percent: config.eod_close_premium_percent,
        manual_close_premium_percent: config.manual_close_premium_percent,
        support_lower_bound_percent: config.support_lower_bound_percent,
        support_upper_bound_percent: config.support_upper_bound_percent,
        minimum_notional_per_symbol: config.minimum_notional_per_symbol,
        quantity_increment_per_symbol: config.quantity_increment_per_symbol,
        updated_at: new Date().toISOString(),
      };

      console.log('Saving config data with all fields:', configData);

      if (hasExistingConfig) {
        const { error } = await supabase
          .from('trading_configs')
          .update(configData)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('trading_configs')
          .insert({
            user_id: user.id,
            ...configData,
          });

        if (error) throw error;
        setHasExistingConfig(true);
      }

      toast({
        title: "Success",
        description: "Trading configuration saved successfully.",
      });

      if (onConfigUpdate) {
        onConfigUpdate();
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: "Failed to save trading configuration.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof TradingConfigData, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNumberInput = (field: keyof TradingConfigData, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      handleInputChange(field, numValue);
    } else if (value === '') {
      handleInputChange(field, 0);
    }
  };

  const handleIntegerInput = (field: keyof TradingConfigData, value: string) => {
    const intValue = parseInt(value);
    if (!isNaN(intValue)) {
      handleInputChange(field, intValue);
    } else if (value === '') {
      handleInputChange(field, 0);
    }
  };

  return {
    config,
    isLoading,
    handleSave,
    handleInputChange,
    handleNumberInput,
    handleIntegerInput
  };
};
