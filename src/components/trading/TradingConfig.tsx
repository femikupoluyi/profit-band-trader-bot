
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Save, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import TradingConfigForm from './config/TradingConfigForm';
import { useTradingConfig } from './config/useTradingConfig';
import { ConfigValidator } from '@/services/trading/core/ConfigValidator';
import TradingSystemTest from './TradingSystemTest';

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

  // Validate config in real-time
  const validationResult = React.useMemo(() => {
    const mainValidation = ConfigValidator.validateTradingConfig(config);
    const pairsValidation = ConfigValidator.validateTradingPairs(config);
    const riskValidation = ConfigValidator.validateRiskParameters(config);

    return {
      isValid: mainValidation.isValid && pairsValidation.isValid && riskValidation.isValid,
      errors: [...mainValidation.errors, ...pairsValidation.errors, ...riskValidation.errors],
      warnings: [...mainValidation.warnings, ...pairsValidation.warnings, ...riskValidation.warnings]
    };
  }, [config]);

  // Ensure valid trading pairs are set
  React.useEffect(() => {
    if (config.trading_pairs && config.trading_pairs.length === 0) {
      const validPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];
      handleInputChange('trading_pairs', validPairs);
    }
  }, [config.trading_pairs, handleInputChange]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Trading Configuration</CardTitle>
          <CardDescription>
            Configure your automated trading bot parameters and risk management settings.
            All limit-only orders with configurable take-profits and manual market-close options.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto Decimal Precision Notice */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-1">🎯 Smart Decimal Precision</div>
              Decimal places for prices and quantities are now automatically fetched from Bybit's API 
              for each trading pair, ensuring perfect compliance with exchange requirements.
            </AlertDescription>
          </Alert>

          {/* Validation Status */}
          {validationResult.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Configuration Errors:</div>
                <ul className="list-disc list-inside space-y-1">
                  {validationResult.errors.map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validationResult.warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Configuration Warnings:</div>
                <ul className="list-disc list-inside space-y-1">
                  {validationResult.warnings.map((warning, index) => (
                    <li key={index} className="text-sm">{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validationResult.isValid && validationResult.errors.length === 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Configuration is valid and ready for trading.
              </AlertDescription>
            </Alert>
          )}

          <TradingConfigForm
            config={config}
            onInputChange={handleInputChange}
            onNumberInput={handleNumberInput}
            onIntegerInput={handleIntegerInput}
          />

          <div className="flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={isLoading || !validationResult.isValid}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      <TradingSystemTest />
    </div>
  );
};

export default TradingConfig;
