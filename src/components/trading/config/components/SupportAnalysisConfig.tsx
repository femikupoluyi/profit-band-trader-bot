
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TradingConfigData } from '../types/configTypes';

interface SupportAnalysisConfigProps {
  config: TradingConfigData;
  onInputChange: (field: keyof TradingConfigData, value: any) => void;
  onNumberInput: (field: keyof TradingConfigData, value: number) => void;
  onIntegerInput: (field: keyof TradingConfigData, value: number) => void;
}

const SupportAnalysisConfig: React.FC<SupportAnalysisConfigProps> = ({
  config,
  onInputChange,
  onNumberInput,
  onIntegerInput
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Support Analysis Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="support_candle_count">Support Analysis Candles</Label>
            <Input
              id="support_candle_count"
              type="number"
              value={config.support_candle_count?.toString() || ''}
              onChange={(e) => onIntegerInput('support_candle_count', parseInt(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new_support_threshold_percent">New Support Threshold (%)</Label>
            <Input
              id="new_support_threshold_percent"
              type="number"
              step="0.1"
              value={config.new_support_threshold_percent?.toString() || ''}
              onChange={(e) => onNumberInput('new_support_threshold_percent', parseFloat(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="support_lower_bound_percent">Support Lower Bound (%)</Label>
            <Input
              id="support_lower_bound_percent"
              type="number"
              step="0.1"
              value={config.support_lower_bound_percent?.toString() || ''}
              onChange={(e) => onNumberInput('support_lower_bound_percent', parseFloat(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="support_upper_bound_percent">Support Upper Bound (%)</Label>
            <Input
              id="support_upper_bound_percent"
              type="number"
              step="0.1"
              value={config.support_upper_bound_percent?.toString() || ''}
              onChange={(e) => onNumberInput('support_upper_bound_percent', parseFloat(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chart_timeframe">Chart Timeframe</Label>
            <Select value={config.chart_timeframe} onValueChange={(value) => onInputChange('chart_timeframe', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select timeframe" />
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
        </div>
      </CardContent>
    </Card>
  );
};

export default SupportAnalysisConfig;
