
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import { TradingConfigForm } from './config/TradingConfigForm';
import { useTradingConfig } from './config/useTradingConfig';

interface TradingConfigProps {
  onConfigUpdate?: () => void;
}

const TradingConfig: React.FC<TradingConfigProps> = ({ onConfigUpdate }) => {
  const {
    config,
    isLoading,
    handleSave,
    handleInputChange,
    handleNumberInput,
    handleIntegerInput
  } = useTradingConfig(onConfigUpdate);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Configuration</CardTitle>
        <CardDescription>
          Configure your automated trading bot parameters and risk management settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <TradingConfigForm
          config={config}
          onInputChange={handleInputChange}
          onNumberInput={handleNumberInput}
          onIntegerInput={handleIntegerInput}
        />

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TradingConfig;
