import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { TradingConfigData } from './useTradingConfig';
import DecimalConfigSection from './DecimalConfigSection';
import { TradingPairsService } from '@/services/trading/core/TradingPairsService';
import { useAuth } from '@/hooks/useAuth';
import { BybitService } from '@/services/bybitService';

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
  const { user } = useAuth();
  const [availablePairs, setAvailablePairs] = useState<string[]>([
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 
    'XRPUSDT', 'LTCUSDT', 'DOGEUSDT', 'MATICUSDT', 'FETUSDT', 
    'POLUSDT', 'XLMUSDT'
  ]);

  // Fetch active trading pairs when the component mounts
  useEffect(() => {
    const fetchPairs = async () => {
      try {
        // In a real implementation, we would initialize the BybitService properly
        // For now, we'll use the static method directly
        const pairs = await TradingPairsService.fetchActiveTradingPairs(new BybitService('', ''));
        setAvailablePairs(pairs);
      } catch (error) {
        console.error('Failed to fetch trading pairs:', error);
      }
    };

    fetchPairs();
  }, []);

  const handleTradingPairToggle = (pair: string, checked: boolean) => {
    const currentPairs = config.trading_pairs || [];
    if (checked) {
      if (!currentPairs.includes(pair)) {
        onInputChange('trading_pairs', [...currentPairs, pair]);
      }
    } else {
      onInputChange('trading_pairs', currentPairs.filter(p => p !== pair));
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Trading Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Trading Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_order_amount_usd">Max Order Amount (USD)</Label>
              <Input
                id="max_order_amount_usd"
                type="number"
                value={config.max_order_amount_usd?.toString() || ''}
                onChange={(e) => onNumberInput('max_order_amount_usd', parseFloat(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="take_profit_percent">Take Profit (%)</Label>
              <Input
                id="take_profit_percent"
                type="number"
                step="0.1"
                value={config.take_profit_percent?.toString() || ''}
                onChange={(e) => onNumberInput('take_profit_percent', parseFloat(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry_offset_percent">Entry Offset (%)</Label>
              <Input
                id="entry_offset_percent"
                type="number"
                step="0.1"
                value={config.entry_offset_percent?.toString() || ''}
                onChange={(e) => onNumberInput('entry_offset_percent', parseFloat(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_portfolio_exposure_percent">Max Portfolio Exposure (%)</Label>
              <Input
                id="max_portfolio_exposure_percent"
                type="number"
                step="0.1"
                value={config.max_portfolio_exposure_percent?.toString() || ''}
                onChange={(e) => onNumberInput('max_portfolio_exposure_percent', parseFloat(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Position Management */}
      <Card>
        <CardHeader>
          <CardTitle>Position Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_active_pairs">Max Active Pairs</Label>
              <Input
                id="max_active_pairs"
                type="number"
                value={config.max_active_pairs?.toString() || ''}
                onChange={(e) => onIntegerInput('max_active_pairs', parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_positions_per_pair">Max Positions per Pair</Label>
              <Input
                id="max_positions_per_pair"
                type="number"
                value={config.max_positions_per_pair?.toString() || ''}
                onChange={(e) => onIntegerInput('max_positions_per_pair', parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_concurrent_trades">Max Concurrent Trades</Label>
              <Input
                id="max_concurrent_trades"
                type="number"
                value={config.max_concurrent_trades?.toString() || ''}
                onChange={(e) => onIntegerInput('max_concurrent_trades', parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_drawdown_percent">Max Drawdown (%)</Label>
              <Input
                id="max_drawdown_percent"
                type="number"
                step="0.1"
                value={config.max_drawdown_percent?.toString() || ''}
                onChange={(e) => onNumberInput('max_drawdown_percent', parseFloat(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Support Analysis Configuration */}
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

      {/* Trading Pairs Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Trading Pairs Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {availablePairs.map((pair) => (
              <div key={pair} className="flex items-center space-x-2">
                <Checkbox
                  id={`pair-${pair}`}
                  checked={config.trading_pairs?.includes(pair) || false}
                  onCheckedChange={(checked) => handleTradingPairToggle(pair, checked as boolean)}
                />
                <Label htmlFor={`pair-${pair}`} className="text-sm font-medium">
                  {pair}
                </Label>
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-600">
            Selected pairs: {config.trading_pairs?.length || 0} / {availablePairs.length}
          </div>
        </CardContent>
      </Card>

      {/* End of Day Management */}
      <Card>
        <CardHeader>
          <CardTitle>End of Day Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="auto_close_at_end_of_day"
              checked={config.auto_close_at_end_of_day || false}
              onCheckedChange={(checked) => onInputChange('auto_close_at_end_of_day', checked)}
            />
            <Label htmlFor="auto_close_at_end_of_day">Auto Close at End of Day</Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily_reset_time">Daily Reset Time</Label>
              <Input
                id="daily_reset_time"
                type="time"
                value={config.daily_reset_time || '00:00:00'}
                onChange={(e) => onInputChange('daily_reset_time', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eod_close_premium_percent">EOD Close Premium (%)</Label>
              <Input
                id="eod_close_premium_percent"
                type="number"
                step="0.01"
                value={config.eod_close_premium_percent?.toString() || ''}
                onChange={(e) => onNumberInput('eod_close_premium_percent', parseFloat(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual_close_premium_percent">Manual Close Premium (%)</Label>
              <Input
                id="manual_close_premium_percent"
                type="number"
                step="0.01"
                value={config.manual_close_premium_percent?.toString() || ''}
                onChange={(e) => onNumberInput('manual_close_premium_percent', parseFloat(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>System Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="main_loop_interval_seconds">Main Loop Interval (seconds)</Label>
            <Input
              id="main_loop_interval_seconds"
              type="number"
              value={config.main_loop_interval_seconds?.toString() || ''}
              onChange={(e) => onIntegerInput('main_loop_interval_seconds', parseInt(e.target.value))}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={config.is_active || false}
              onCheckedChange={(checked) => onInputChange('is_active', checked)}
            />
            <Label htmlFor="is_active">Trading Active</Label>
          </div>
        </CardContent>
      </Card>

      {/* Decimal Configuration Section - Updated to use dynamic pairs */}
      <DecimalConfigSection
        config={config}
        onInputChange={onInputChange}
        availablePairs={availablePairs}
      />

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes & Additional Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Trading Strategy Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about your trading strategy, risk management rules, or configuration details..."
              value={config.notes || ''}
              onChange={(e) => onInputChange('notes', e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TradingConfigForm;
