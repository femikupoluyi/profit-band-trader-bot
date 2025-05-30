
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TradingConfigData {
  min_profit_percent: number;
  max_active_pairs: number;
  max_order_amount_usd: number;
  max_portfolio_exposure_percent: number;
  daily_reset_time: string;
  chart_timeframe: string;
  buy_range_lower_offset: number;
  buy_range_upper_offset: number;
  sell_range_offset: number;
  is_active: boolean;
}

export const useTradingConfig = (onConfigUpdate?: () => void) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [config, setConfig] = useState<TradingConfigData>({
    min_profit_percent: 5.0,
    max_active_pairs: 5,
    max_order_amount_usd: 100.0,
    max_portfolio_exposure_percent: 25.0,
    daily_reset_time: '00:00:00',
    chart_timeframe: '4h',
    buy_range_lower_offset: -1.5,
    buy_range_upper_offset: 1.0,
    sell_range_offset: 5.5,
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
      const { data, error } = await (supabase as any)
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
          min_profit_percent: parseFloat(data.min_profit_percent) || 5.0,
          max_active_pairs: data.max_active_pairs || 5,
          max_order_amount_usd: parseFloat(data.max_order_amount_usd) || 100.0,
          max_portfolio_exposure_percent: parseFloat(data.max_portfolio_exposure_percent) || 25.0,
          daily_reset_time: data.daily_reset_time || '00:00:00',
          chart_timeframe: data.chart_timeframe || '4h',
          buy_range_lower_offset: parseFloat(data.buy_range_lower_offset) || -1.5,
          buy_range_upper_offset: parseFloat(data.buy_range_upper_offset) || 1.0,
          sell_range_offset: parseFloat(data.sell_range_offset) || 5.5,
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
      if (hasExistingConfig) {
        // Update existing config
        const { error } = await (supabase as any)
          .from('trading_configs')
          .update({
            ...config,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new config
        const { error } = await (supabase as any)
          .from('trading_configs')
          .insert({
            user_id: user.id,
            ...config,
            updated_at: new Date().toISOString(),
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
      // Allow empty string temporarily while user is typing
      handleInputChange(field, 0);
    }
  };

  const handleIntegerInput = (field: keyof TradingConfigData, value: string) => {
    const intValue = parseInt(value);
    if (!isNaN(intValue)) {
      handleInputChange(field, intValue);
    } else if (value === '') {
      // Allow empty string temporarily while user is typing
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
