
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
      if (!isNaN(value) && typeof value === 'number') {
        handleInputChange(field, value);
      } else {
        console.warn(`Invalid number value for field ${field}:`, value);
        handleInputChange(field, 0);
      }
    } catch (error) {
      console.error(`Error handling number input for field ${field}:`, error);
      handleInputChange(field, 0);
    }
  };

  const handleIntegerInput = (field: keyof TradingConfigData, value: number) => {
    try {
      if (!isNaN(value) && typeof value === 'number' && Number.isInteger(value)) {
        handleInputChange(field, value);
      } else {
        console.warn(`Invalid integer value for field ${field}:`, value);
        handleInputChange(field, 0);
      }
    } catch (error) {
      console.error(`Error handling integer input for field ${field}:`, error);
      handleInputChange(field, 0);
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
