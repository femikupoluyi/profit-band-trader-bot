
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TradingConfigData {
  min_profit_percent: number;
  max_active_pairs: number;
  max_order_amount_usd: number;
  max_portfolio_exposure_percent: number;
  daily_reset_time: string;
  chart_timeframe: string;
  buy_range_lower_offset: number;
  buy_range_upper_offset: number;
  sell_range_offset: number;
  is_active: boolean;
}

interface TradingConfigFormProps {
  config: TradingConfigData;
  onInputChange: (field: keyof TradingConfigData, value: any) => void;
  onNumberInput: (field: keyof TradingConfigData, value: string) => void;
  onIntegerInput: (field: keyof TradingConfigData, value: string) => void;
}

export const TradingConfigForm: React.FC<TradingConfigFormProps> = ({
  config,
  onInputChange,
  onNumberInput,
  onIntegerInput
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Bot Status */}
      <div className="space-y-2">
        <Label>Bot Status</Label>
        <div className="flex items-center space-x-2">
          <Switch
            checked={config.is_active}
            onCheckedChange={(checked) => onInputChange('is_active', checked)}
          />
          <span className="text-sm text-gray-600">
            {config.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Min Profit Percentage */}
      <div className="space-y-2">
        <Label htmlFor="min_profit_percent">Minimum Profit Percentage (%)</Label>
        <Input
          id="min_profit_percent"
          type="number"
          step="0.1"
          value={config.min_profit_percent}
          onChange={(e) => onNumberInput('min_profit_percent', e.target.value)}
        />
      </div>

      {/* Max Active Pairs */}
      <div className="space-y-2">
        <Label htmlFor="max_active_pairs">Maximum Active Pairs</Label>
        <Input
          id="max_active_pairs"
          type="number"
          value={config.max_active_pairs}
          onChange={(e) => onIntegerInput('max_active_pairs', e.target.value)}
        />
      </div>

      {/* Max Order Amount */}
      <div className="space-y-2">
        <Label htmlFor="max_order_amount_usd">Maximum Order Amount (USD)</Label>
        <Input
          id="max_order_amount_usd"
          type="number"
          step="0.01"
          value={config.max_order_amount_usd}
          onChange={(e) => onNumberInput('max_order_amount_usd', e.target.value)}
        />
      </div>

      {/* Max Portfolio Exposure */}
      <div className="space-y-2">
        <Label htmlFor="max_portfolio_exposure_percent">Maximum Portfolio Exposure (%)</Label>
        <Input
          id="max_portfolio_exposure_percent"
          type="number"
          step="0.1"
          value={config.max_portfolio_exposure_percent}
          onChange={(e) => onNumberInput('max_portfolio_exposure_percent', e.target.value)}
        />
      </div>

      {/* Chart Timeframe */}
      <div className="space-y-2">
        <Label>Chart Timeframe</Label>
        <Select
          value={config.chart_timeframe}
          onValueChange={(value) => onInputChange('chart_timeframe', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1m">1 Minute</SelectItem>
            <SelectItem value="5m">5 Minutes</SelectItem>
            <SelectItem value="15m">15 Minutes</SelectItem>
            <SelectItem value="1h">1 Hour</SelectItem>
            <SelectItem value="4h">4 Hours</SelectItem>
            <SelectItem value="1d">1 Day</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Daily Reset Time */}
      <div className="space-y-2">
        <Label htmlFor="daily_reset_time">Daily Reset Time</Label>
        <Input
          id="daily_reset_time"
          type="time"
          value={config.daily_reset_time}
          onChange={(e) => onInputChange('daily_reset_time', e.target.value)}
        />
      </div>

      {/* Buy Range Lower Offset */}
      <div className="space-y-2">
        <Label htmlFor="buy_range_lower_offset">Buy Range Lower Offset (%)</Label>
        <Input
          id="buy_range_lower_offset"
          type="number"
          step="0.1"
          value={config.buy_range_lower_offset}
          onChange={(e) => onNumberInput('buy_range_lower_offset', e.target.value)}
        />
      </div>

      {/* Buy Range Upper Offset */}
      <div className="space-y-2">
        <Label htmlFor="buy_range_upper_offset">Buy Range Upper Offset (%)</Label>
        <Input
          id="buy_range_upper_offset"
          type="number"
          step="0.1"
          value={config.buy_range_upper_offset}
          onChange={(e) => onNumberInput('buy_range_upper_offset', e.target.value)}
        />
      </div>

      {/* Sell Range Offset */}
      <div className="space-y-2">
        <Label htmlFor="sell_range_offset">Sell Range Offset (%)</Label>
        <Input
          id="sell_range_offset"
          type="number"
          step="0.1"
          value={config.sell_range_offset}
          onChange={(e) => onNumberInput('sell_range_offset', e.target.value)}
        />
      </div>
    </div>
  );
};
