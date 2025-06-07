
import { useEffect } from 'react';
import { useConfigDataLoader } from './hooks/useConfigDataLoader';
import { useConfigFormState } from './hooks/useConfigFormState';
import { TradingConfigData } from './types/configTypes';

export type { TradingConfigData } from './types/configTypes';
export { getDefaultConfig } from './types/configTypes';

export const useTradingConfig = (onConfigUpdate?: () => void) => {
  const { config: loadedConfig, isLoading, saveConfig } = useConfigDataLoader(onConfigUpdate);
  const { 
    config, 
    setConfig, 
    handleInputChange, 
    handleNumberInput, 
    handleIntegerInput 
  } = useConfigFormState(loadedConfig);

  // Update the form state when the loaded config changes
  useEffect(() => {
    setConfig(loadedConfig);
  }, [loadedConfig]);

  const handleSave = async () => {
    return await saveConfig(config);
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
