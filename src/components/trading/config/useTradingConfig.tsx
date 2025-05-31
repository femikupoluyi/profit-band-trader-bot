
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
}

export const useTradingConfig = (onConfigUpdate?: () => void) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [config, setConfig] = useState<TradingConfigData>({
    max_active_pairs: 5,
    max_order_amount_usd: 100.0,
    max_portfolio_exposure_percent: 25.0,
    daily_reset_time: '00:00:00',
    chart_timeframe: '4h',
    entry_offset_percent: 1.0,
    take_profit_percent: 2.0,
    support_candle_count: 20,
    max_positions_per_pair: 2,
    new_support_threshold_percent: 2.0,
    trading_pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 'POLUSDT', 'FETUSDT', 'XRPUSDT', 'XLMUSDT'],
    is_active: false,
  });

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
        setConfig({
          max_active_pairs: data.max_active_pairs || 5,
          max_order_amount_usd: parseFloat(data.max_order_amount_usd?.toString() || '100'),
          max_portfolio_exposure_percent: parseFloat(data.max_portfolio_exposure_percent?.toString() || '25'),
          daily_reset_time: data.daily_reset_time || '00:00:00',
          chart_timeframe: data.chart_timeframe || '4h',
          entry_offset_percent: parseFloat(data.buy_range_upper_offset?.toString() || '1'),
          take_profit_percent: parseFloat(data.sell_range_offset?.toString() || '2'),
          support_candle_count: data.support_candle_count || 20,
          max_positions_per_pair: data.max_positions_per_pair || 2,
          new_support_threshold_percent: parseFloat(data.new_support_threshold_percent?.toString() || '2'),
          trading_pairs: data.trading_pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 'POLUSDT', 'FETUSDT', 'XRPUSDT', 'XLMUSDT'],
          is_active: data.is_active || false,
        });
      } else {
        setHasExistingConfig(false);
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
      // Convert all numeric values properly
      const configData = {
        max_active_pairs: config.max_active_pairs,
        max_order_amount_usd: config.max_order_amount_usd,
        max_portfolio_exposure_percent: config.max_portfolio_exposure_percent,
        daily_reset_time: config.daily_reset_time,
        chart_timeframe: config.chart_timeframe,
        buy_range_upper_offset: config.entry_offset_percent,
        sell_range_offset: config.take_profit_percent,
        support_candle_count: config.support_candle_count,
        max_positions_per_pair: config.max_positions_per_pair,
        new_support_threshold_percent: config.new_support_threshold_percent,
        trading_pairs: config.trading_pairs,
        is_active: config.is_active,
        updated_at: new Date().toISOString(),
      };

      console.log('Saving config data:', configData);

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
