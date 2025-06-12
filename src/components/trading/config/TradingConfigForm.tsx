
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TradingConfigData } from './types/configTypes';
import TradingPairsSelector from './components/TradingPairsSelector';
import TradingLogicSelection from './components/TradingLogicSelection';

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
      {/* Trading Logic Selection */}
      <TradingLogicSelection
        config={config}
        onInputChange={onInputChange}
        onNumberInput={onNumberInput}
        onIntegerInput={onIntegerInput}
      />

      {/* Trading Pairs Configuration */}
      <TradingPairsSelector
        selectedPairs={config.trading_pairs}
        onPairsChange={(pairs) => onInputChange('trading_pairs', pairs)}
        maxActive={config.max_active_pairs}
      />

      {/* Basic Trading Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Trading Parameters</CardTitle>
          <CardDescription>
            Core settings for order sizing and risk management
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="max_order_amount_usd">Max Order Amount (USD)</Label>
            <Input
              id="max_order_amount_usd"
              type="number"
              min="10"
              max="10000"
              value={config.max_order_amount_usd}
              onChange={(e) => onNumberInput('max_order_amount_usd', parseFloat(e.target.value) || 50)}
            />
          </div>

          <div>
            <Label htmlFor="take_profit_percent">Take Profit %</Label>
            <Input
              id="take_profit_percent"
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={config.take_profit_percent}
              onChange={(e) => onNumberInput('take_profit_percent', parseFloat(e.target.value) || 1.0)}
            />
          </div>

          <div>
            <Label htmlFor="entry_offset_percent">Entry Offset %</Label>
            <Input
              id="entry_offset_percent"
              type="number"
              min="0.01"
              max="2"
              step="0.01"
              value={config.entry_offset_percent}
              onChange={(e) => onNumberInput('entry_offset_percent', parseFloat(e.target.value) || 0.5)}
            />
          </div>

          <div>
            <Label htmlFor="max_active_pairs">Max Active Pairs</Label>
            <Input
              id="max_active_pairs"
              type="number"
              min="1"
              max="20"
              value={config.max_active_pairs}
              onChange={(e) => onIntegerInput('max_active_pairs', parseInt(e.target.value) || 5)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Support Level Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Support Level Analysis</CardTitle>
          <CardDescription>
            Configure support detection and entry boundaries
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="support_candle_count">Support Analysis Candles</Label>
            <Input
              id="support_candle_count"
              type="number"
              min="50"
              max="500"
              value={config.support_candle_count}
              onChange={(e) => onIntegerInput('support_candle_count', parseInt(e.target.value) || 128)}
            />
          </div>

          <div>
            <Label htmlFor="support_lower_bound_percent">Support Lower Bound %</Label>
            <Input
              id="support_lower_bound_percent"
              type="number"
              min="0.5"
              max="10"
              step="0.1"
              value={config.support_lower_bound_percent}
              onChange={(e) => onNumberInput('support_lower_bound_percent', parseFloat(e.target.value) || 5.0)}
            />
          </div>

          <div>
            <Label htmlFor="support_upper_bound_percent">Support Upper Bound %</Label>
            <Input
              id="support_upper_bound_percent"
              type="number"
              min="0.1"
              max="5"
              step="0.1"
              value={config.support_upper_bound_percent}
              onChange={(e) => onNumberInput('support_upper_bound_percent', parseFloat(e.target.value) || 2.0)}
            />
          </div>

          <div>
            <Label htmlFor="max_positions_per_pair">Max Positions Per Pair</Label>
            <Input
              id="max_positions_per_pair"
              type="number"
              min="1"
              max="5"
              value={config.max_positions_per_pair}
              onChange={(e) => onIntegerInput('max_positions_per_pair', parseInt(e.target.value) || 2)}
            />
          </div>
        </CardContent>
      </Card>

      {/* System Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>System Configuration</CardTitle>
          <CardDescription>
            Bot operation settings and timing parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="chart_timeframe">Chart Timeframe</Label>
              <Select value={config.chart_timeframe} onValueChange={(value) => onInputChange('chart_timeframe', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 minute</SelectItem>
                  <SelectItem value="3m">3 minutes</SelectItem>
                  <SelectItem value="5m">5 minutes</SelectItem>
                  <SelectItem value="15m">15 minutes</SelectItem>
                  <SelectItem value="30m">30 minutes</SelectItem>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="2h">2 hours</SelectItem>
                  <SelectItem value="4h">4 hours</SelectItem>
                  <SelectItem value="6h">6 hours</SelectItem>
                  <SelectItem value="8h">8 hours</SelectItem>
                  <SelectItem value="12h">12 hours</SelectItem>
                  <SelectItem value="1d">1 day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="main_loop_interval_seconds">Main Loop Interval (seconds)</Label>
              <Input
                id="main_loop_interval_seconds"
                type="number"
                min="10"
                max="600"
                value={config.main_loop_interval_seconds}
                onChange={(e) => onIntegerInput('main_loop_interval_seconds', parseInt(e.target.value) || 30)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={config.is_active}
              onCheckedChange={(checked) => onInputChange('is_active', checked)}
            />
            <Label htmlFor="is_active">Trading Bot Active</Label>
          </div>

          <div>
            <Label htmlFor="notes">Configuration Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this configuration..."
              value={config.notes}
              onChange={(e) => onInputChange('notes', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TradingConfigForm;
