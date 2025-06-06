
import { useState } from 'react';
import { TradingConfigData } from '../types/configTypes';

export const useConfigFormState = (initialConfig: TradingConfigData) => {
  const [config, setConfig] = useState<TradingConfigData>(initialConfig);

  const handleInputChange = (field: keyof TradingConfigData, value: any) => {
    try {
      setConfig(prev => ({
        ...prev,
        [field]: value
      }));
    } catch (error) {
      console.error(`Error updating config field ${field}:`, error);
    }
  };

  const handleNumberInput = (field: keyof TradingConfigData, value: number) => {
    try {
      // Validate the number input
      if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        console.warn(`Invalid number value for field ${field}:`, value);
        return; // Don't update with invalid values
      }
      
      // Ensure positive values for certain fields
      const positiveFields = [
        'max_order_amount_usd', 
        'take_profit_percent', 
        'entry_offset_percent',
        'max_portfolio_exposure_percent',
        'eod_close_premium_percent',
        'manual_close_premium_percent',
        'support_lower_bound_percent',
        'support_upper_bound_percent',
        'new_support_threshold_percent',
        'max_drawdown_percent'
      ];
      
      if (positiveFields.includes(field as string) && value < 0) {
        console.warn(`Negative value not allowed for field ${field}:`, value);
        return;
      }
      
      handleInputChange(field, value);
    } catch (error) {
      console.error(`Error handling number input for field ${field}:`, error);
    }
  };

  const handleIntegerInput = (field: keyof TradingConfigData, value: number) => {
    try {
      // Validate the integer input
      if (typeof value !== 'number' || isNaN(value) || !isFinite(value) || !Number.isInteger(value)) {
        console.warn(`Invalid integer value for field ${field}:`, value);
        return; // Don't update with invalid values
      }
      
      // Ensure positive values for integer fields
      const positiveIntegerFields = [
        'max_active_pairs',
        'max_positions_per_pair', 
        'support_candle_count',
        'main_loop_interval_seconds',
        'max_concurrent_trades'
      ];
      
      if (positiveIntegerFields.includes(field as string) && value <= 0) {
        console.warn(`Non-positive value not allowed for field ${field}:`, value);
        return;
      }
      
      handleInputChange(field, value);
    } catch (error) {
      console.error(`Error handling integer input for field ${field}:`, error);
    }
  };

  return {
    config,
    setConfig,
    handleInputChange,
    handleNumberInput,
    handleIntegerInput
  };
};
