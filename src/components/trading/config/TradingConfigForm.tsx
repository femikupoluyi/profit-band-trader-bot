
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface TradingConfigData {
  max_active_pairs: number;
  max_order_amount_usd: number;
  max_portfolio_exposure_percent: number;
  daily_reset_time: string;
  chart_timeframe: string;
  entry_offset_percent: number;
  take_profit_percent: number;
  support_candle_count: number;
  max_positions_per_pair: number;
  new_support_threshold_percent: number;
  trading_pairs: string[];
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
  const [newPair, setNewPair] = React.useState('');

  const addTradingPair = () => {
    if (newPair && !config.trading_pairs.includes(newPair)) {
      onInputChange('trading_pairs', [...config.trading_pairs, newPair]);
      setNewPair('');
    }
  };

  const removeTradingPair = (pairToRemove: string) => {
    onInputChange('trading_pairs', config.trading_pairs.filter(pair => pair !== pairToRemove));
  };

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        {/* Max Positions Per Pair */}
        <div className="space-y-2">
          <Label htmlFor="max_positions_per_pair">Max Positions Per Pair</Label>
          <Input
            id="max_positions_per_pair"
            type="number"
            value={config.max_positions_per_pair}
            onChange={(e) => onIntegerInput('max_positions_per_pair', e.target.value)}
          />
          <p className="text-xs text-gray-500">Maximum open positions allowed per trading pair</p>
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

        {/* Support Candle Count */}
        <div className="space-y-2">
          <Label htmlFor="support_candle_count">Support Analysis Candles</Label>
          <Input
            id="support_candle_count"
            type="number"
            value={config.support_candle_count}
            onChange={(e) => onIntegerInput('support_candle_count', e.target.value)}
          />
          <p className="text-xs text-gray-500">Number of candles for support level analysis</p>
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

        {/* Entry Offset Percentage */}
        <div className="space-y-2">
          <Label htmlFor="entry_offset_percent">Entry Above Support (%)</Label>
          <Input
            id="entry_offset_percent"
            type="number"
            step="0.01"
            min="0.01"
            max="5.0"
            value={config.entry_offset_percent}
            onChange={(e) => onNumberInput('entry_offset_percent', e.target.value)}
          />
          <p className="text-xs text-gray-500">Entry price: percentage above support line</p>
        </div>

        {/* Take Profit Percentage */}
        <div className="space-y-2">
          <Label htmlFor="take_profit_percent">Take Profit (%)</Label>
          <Input
            id="take_profit_percent"
            type="number"
            step="0.01"
            min="0.01"
            max="20.0"
            value={config.take_profit_percent}
            onChange={(e) => onNumberInput('take_profit_percent', e.target.value)}
          />
          <p className="text-xs text-gray-500">Profit target above entry price</p>
        </div>

        {/* New Support Threshold */}
        <div className="space-y-2">
          <Label htmlFor="new_support_threshold_percent">New Support Threshold (%)</Label>
          <Input
            id="new_support_threshold_percent"
            type="number"
            step="0.01"
            min="0.01"
            max="10.0"
            value={config.new_support_threshold_percent}
            onChange={(e) => onNumberInput('new_support_threshold_percent', e.target.value)}
          />
          <p className="text-xs text-gray-500">Min % drop from entry to allow new position</p>
        </div>
      </div>

      {/* Trading Pairs */}
      <div className="space-y-4">
        <Label>Trading Pairs</Label>
        
        {/* Add new pair */}
        <div className="flex gap-2">
          <Input
            placeholder="e.g., ADAUSDT"
            value={newPair}
            onChange={(e) => setNewPair(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && addTradingPair()}
          />
          <Button type="button" onClick={addTradingPair} variant="outline">
            Add Pair
          </Button>
        </div>
        
        {/* Current pairs */}
        <div className="flex flex-wrap gap-2">
          {config.trading_pairs.map((pair) => (
            <Badge key={pair} variant="secondary" className="flex items-center gap-1">
              {pair}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-red-500" 
                onClick={() => removeTradingPair(pair)}
              />
            </Badge>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Default pairs: BTC, ETH, SOL, BNB, LTC, POL, FET, XRP, XLM
        </p>
      </div>
    </div>
  );
};
