
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '../types/configTypes';

export const useConfigDatabase = (onConfigUpdate?: () => void) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);

  const fetchConfig = async () => {
    if (!user?.id) {
      console.error('No user ID available for config fetch');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching config:', error);
        throw error;
      }

      if (data) {
        setHasExistingConfig(true);
        return data;
      } else {
        setHasExistingConfig(false);
        return null;
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      toast({
        title: "Error",
        description: "Failed to load trading configuration.",
        variant: "destructive",
      });
      return null;
    }
  };

  const saveConfig = async (configData: TradingConfigData) => {
    if (!user?.id) {
      console.error('No user ID available for config save');
      toast({
        title: "Error",
        description: "User authentication required.",
        variant: "destructive",
      });
      return false;
    }

    if (!configData) {
      console.error('No config data provided');
      toast({
        title: "Error",
        description: "Configuration data is required.",
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);
    try {
      // Always check if config exists first
      const { data: existingConfig } = await supabase
        .from('trading_configs')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Validate required fields
      if (!configData.trading_pairs || configData.trading_pairs.length === 0) {
        toast({
          title: "Validation Error",
          description: "At least one trading pair must be configured.",
          variant: "destructive",
        });
        return false;
      }

      const dbData = {
        max_active_pairs: Math.max(1, configData.max_active_pairs || 5),
        max_order_amount_usd: Math.max(1, configData.max_order_amount_usd || 100),
        max_portfolio_exposure_percent: Math.min(100, Math.max(1, configData.max_portfolio_exposure_percent || 25)),
        daily_reset_time: configData.daily_reset_time || '00:00:00',
        chart_timeframe: configData.chart_timeframe || '4h',
        entry_offset_percent: Math.max(0, configData.entry_offset_percent || 0.5),
        take_profit_percent: Math.max(0.1, configData.take_profit_percent || 1.0),
        support_candle_count: Math.max(1, configData.support_candle_count || 128),
        max_positions_per_pair: Math.max(1, configData.max_positions_per_pair || 2),
        new_support_threshold_percent: Math.max(0.1, configData.new_support_threshold_percent || 2.0),
        trading_pairs: configData.trading_pairs,
        is_active: Boolean(configData.is_active),
        main_loop_interval_seconds: Math.min(600, Math.max(10, configData.main_loop_interval_seconds || 30)),
        auto_close_at_end_of_day: Boolean(configData.auto_close_at_end_of_day),
        eod_close_premium_percent: Math.max(0, configData.eod_close_premium_percent || 0.1),
        manual_close_premium_percent: Math.max(0, configData.manual_close_premium_percent || 0.1),
        support_lower_bound_percent: Math.max(0.1, configData.support_lower_bound_percent || 5.0),
        support_upper_bound_percent: Math.max(0.1, configData.support_upper_bound_percent || 2.0),
        minimum_notional_per_symbol: configData.minimum_notional_per_symbol || {},
        quantity_increment_per_symbol: configData.quantity_increment_per_symbol || {},
        price_decimals_per_symbol: configData.price_decimals_per_symbol || {},
        quantity_decimals_per_symbol: configData.quantity_decimals_per_symbol || {},
        max_drawdown_percent: Math.min(50, Math.max(1, configData.max_drawdown_percent || 10)),
        notes: configData.notes || '',
        updated_at: new Date().toISOString(),
      };

      if (existingConfig) {
        // Update existing config
        const { error } = await supabase
          .from('trading_configs')
          .update(dbData)
          .eq('user_id', user.id);

        if (error) throw error;
        setHasExistingConfig(true);
      } else {
        // Insert new config
        const { error } = await supabase
          .from('trading_configs')
          .insert({
            user_id: user.id,
            ...dbData,
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
      
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: "Failed to save trading configuration.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    hasExistingConfig,
    fetchConfig,
    saveConfig,
  };
};
