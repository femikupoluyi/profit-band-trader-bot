
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { TradingConfigData } from '../types/configTypes';
import { TradingLogicFactory } from '@/services/trading/core/TradingLogicFactory';

interface TradingLogicSelectionProps {
  config: TradingConfigData;
  onInputChange: (field: keyof TradingConfigData, value: any) => void;
  onNumberInput: (field: keyof TradingConfigData, value: number) => void;
  onIntegerInput: (field: keyof TradingConfigData, value: number) => void;
}

const TradingLogicSelection: React.FC<TradingLogicSelectionProps> = ({
  config,
  onInputChange,
  onNumberInput,
  onIntegerInput
}) => {
  const allLogics = TradingLogicFactory.getAllLogics();
  const isDataDriven = config.trading_logic_type === 'logic2_data_driven';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Logic Selection</CardTitle>
        <CardDescription>
          Choose the algorithm for support level detection and signal generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="trading_logic_type">Trading Logic Algorithm</Label>
            <Select
              value={config.trading_logic_type}
              onValueChange={(value) => onInputChange('trading_logic_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trading logic" />
              </SelectTrigger>
              <SelectContent>
                {allLogics.map(({ key, logic }) => (
                  <SelectItem key={key} value={key}>
                    {logic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">
              {allLogics.find(({ key }) => key === config.trading_logic_type)?.logic.description}
            </p>
          </div>
        </div>

        {/* Logic 2 Specific Parameters */}
        {isDataDriven && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">Data-Driven Logic Parameters</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="swing_analysis_bars">Swing Analysis Bars</Label>
                <Input
                  id="swing_analysis_bars"
                  type="number"
                  min="10"
                  max="100"
                  value={config.swing_analysis_bars}
                  onChange={(e) => onIntegerInput('swing_analysis_bars', parseInt(e.target.value) || 20)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Number of bars to analyze for swing highs/lows
                </p>
              </div>

              <div>
                <Label htmlFor="volume_lookback_periods">Volume Lookback Periods</Label>
                <Input
                  id="volume_lookback_periods"
                  type="number"
                  min="20"
                  max="200"
                  value={config.volume_lookback_periods}
                  onChange={(e) => onIntegerInput('volume_lookback_periods', parseInt(e.target.value) || 50)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Periods for volume profile analysis
                </p>
              </div>

              <div>
                <Label htmlFor="fibonacci_sensitivity">Fibonacci Sensitivity</Label>
                <Input
                  id="fibonacci_sensitivity"
                  type="number"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={config.fibonacci_sensitivity}
                  onChange={(e) => onNumberInput('fibonacci_sensitivity', parseFloat(e.target.value) || 0.618)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Fibonacci retracement sensitivity (0.1-1.0)
                </p>
              </div>

              <div>
                <Label htmlFor="atr_multiplier">ATR Multiplier</Label>
                <Input
                  id="atr_multiplier"
                  type="number"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={config.atr_multiplier}
                  onChange={(e) => onNumberInput('atr_multiplier', parseFloat(e.target.value) || 1.0)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ATR multiplier for dynamic support bounds
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-sm mb-2">Order Execution</h4>
          <p className="text-sm text-muted-foreground">
            All buy orders are placed as <strong>LIMIT orders</strong> with automatic take profit set at {config.take_profit_percent}% above entry price.
            Orders will be filled only when market price reaches your calculated entry level.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TradingLogicSelection;
