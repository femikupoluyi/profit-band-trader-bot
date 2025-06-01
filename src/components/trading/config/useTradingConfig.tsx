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
        };
        
        console.log('Loaded config from database with updated schema:', loadedConfig);
        setConfig(loadedConfig);
      } else {
        setHasExistingConfig(false);
        console.log('No existing config found, using updated defaults:', getDefaultConfig());
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
        updated_at: new Date().toISOString(),
      };

      console.log('Saving config data with cleaned schema:', configData);

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
