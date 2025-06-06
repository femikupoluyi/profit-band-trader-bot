
import { useState } from 'react';
import { TradingConfigData } from '../types/configTypes';

export const useConfigFormState = (initialConfig: TradingConfigData) => {
  const [config, setConfig] = useState<TradingConfigData>(initialConfig);

  const handleInputChange = (field: keyof TradingConfigData, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNumberInput = (field: keyof TradingConfigData, value: number) => {
    if (!isNaN(value)) {
      handleInputChange(field, value);
    } else {
      handleInputChange(field, 0);
    }
  };

  const handleIntegerInput = (field: keyof TradingConfigData, value: number) => {
    if (!isNaN(value)) {
      handleInputChange(field, value);
    } else {
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
