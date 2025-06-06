
import React from 'react';
import { TradingConfigData } from './types/configTypes';
import BasicTradingParameters from './components/BasicTradingParameters';
import PositionManagement from './components/PositionManagement';
import SupportAnalysisConfig from './components/SupportAnalysisConfig';
import TradingPairsSelection from './components/TradingPairsSelection';
import EndOfDayManagement from './components/EndOfDayManagement';
import SystemConfiguration from './components/SystemConfiguration';
import NotesSection from './components/NotesSection';

interface TradingConfigFormProps {
  config: TradingConfigData;
  onInputChange: (field: keyof TradingConfigData, value: any) => void;
  onNumberInput: (field: keyof TradingConfigData, value: number) => void;
  onIntegerInput: (field: keyof TradingConfigData, value: number) => void;
}

const TradingConfigForm: React.FC<TradingConfigFormProps> = ({
  config,
  onInputChange,
  onNumberInput,
  onIntegerInput
}) => {
  return (
    <div className="space-y-6">
      {/* Basic Trading Parameters */}
      <BasicTradingParameters
        config={config}
        onNumberInput={onNumberInput}
      />

      {/* Position Management */}
      <PositionManagement
        config={config}
        onNumberInput={onNumberInput}
        onIntegerInput={onIntegerInput}
      />

      {/* Support Analysis Configuration */}
      <SupportAnalysisConfig
        config={config}
        onInputChange={onInputChange}
        onNumberInput={onNumberInput}
        onIntegerInput={onIntegerInput}
      />

      {/* Trading Pairs Selection - Now Dynamic */}
      <TradingPairsSelection
        config={config}
        onInputChange={onInputChange}
      />

      {/* End of Day Management */}
      <EndOfDayManagement
        config={config}
        onInputChange={onInputChange}
        onNumberInput={onNumberInput}
      />

      {/* System Configuration */}
      <SystemConfiguration
        config={config}
        onInputChange={onInputChange}
        onIntegerInput={onIntegerInput}
      />

      {/* Notes */}
      <NotesSection
        config={config}
        onInputChange={onInputChange}
      />
    </div>
  );
};

export default TradingConfigForm;
