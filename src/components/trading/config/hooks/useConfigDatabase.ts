
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
    if (!user) return null;

    try {
      console.log('🔍 Fetching trading config for user:', user.id);
      
      const { data, error } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching config:', error);
        throw error;
      }

      if (data) {
        console.log('✅ Found existing config:', data.id);
        setHasExistingConfig(true);
        return data;
      } else {
        console.log('ℹ️ No existing config found');
        setHasExistingConfig(false);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching config:', error);
      toast({
        title: "Error",
        description: "Failed to load trading configuration.",
        variant: "destructive",
      });
      return null;
    }
  };

  const saveConfig = async (configData: TradingConfigData) => {
    if (!user) {
      console.error('❌ No user found for config save');
      return false;
    }

    setIsLoading(true);
    try {
      console.log('💾 Saving trading config for user:', user.id);

      // Always check if config exists first
      const { data: existingConfig } = await supabase
        .from('trading_configs')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const dbData = {
        max_active_pairs: configData.max_active_pairs,
        max_order_amount_usd: configData.max_order_amount_usd,
        max_portfolio_exposure_percent: configData.max_portfolio_exposure_percent,
        daily_reset_time: configData.daily_reset_time,
        chart_timeframe: configData.chart_timeframe,
        entry_offset_percent: configData.entry_offset_percent,
        take_profit_percent: configData.take_profit_percent,
        support_candle_count: configData.support_candle_count,
        max_positions_per_pair: configData.max_positions_per_pair,
        new_support_threshold_percent: configData.new_support_threshold_percent,
        trading_pairs: configData.trading_pairs,
        is_active: configData.is_active,
        main_loop_interval_seconds: configData.main_loop_interval_seconds,
        auto_close_at_end_of_day: configData.auto_close_at_end_of_day,
        eod_close_premium_percent: configData.eod_close_premium_percent,
        manual_close_premium_percent: configData.manual_close_premium_percent,
        support_lower_bound_percent: configData.support_lower_bound_percent,
        support_upper_bound_percent: configData.support_upper_bound_percent,
        minimum_notional_per_symbol: configData.minimum_notional_per_symbol,
        quantity_increment_per_symbol: configData.quantity_increment_per_symbol,
        price_decimals_per_symbol: configData.price_decimals_per_symbol,
        quantity_decimals_per_symbol: configData.quantity_decimals_per_symbol,
        max_drawdown_percent: configData.max_drawdown_percent,
        notes: configData.notes,
        updated_at: new Date().toISOString(),
      };

      if (existingConfig) {
        console.log('🔄 Updating existing config:', existingConfig.id);
        // Update existing config
        const { error } = await supabase
          .from('trading_configs')
          .update(dbData)
          .eq('user_id', user.id);

        if (error) {
          console.error('❌ Error updating config:', error);
          throw error;
        }
        setHasExistingConfig(true);
      } else {
        console.log('➕ Creating new config');
        // Insert new config
        const { error } = await supabase
          .from('trading_configs')
          .insert({
            user_id: user.id,
            ...dbData,
          });

        if (error) {
          console.error('❌ Error creating config:', error);
          throw error;
        }
        setHasExistingConfig(true);
      }

      console.log('✅ Trading config saved successfully');
      toast({
        title: "Success",
        description: "Trading configuration saved successfully.",
      });

      if (onConfigUpdate) {
        onConfigUpdate();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error saving config:', error);
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
