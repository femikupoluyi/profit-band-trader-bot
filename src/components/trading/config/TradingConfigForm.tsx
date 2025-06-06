import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TradingConfigData } from './useTradingConfig';
import DecimalConfigSection from './DecimalConfigSection';

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
  const handleTradingPairsChange = (values: string[]) => {
    onInputChange('trading_pairs', values);
  };

  return (
    <div className="space-y-6">
      {/* Basic Trading Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Trading Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              value={config.take_profit_percent?.toString() || ''}
              onChange={(e) => onNumberInput('take_profit_percent', parseFloat(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry_offset_percent">Entry Offset (%)</Label>
            <Input
              id="entry_offset_percent"
              type="number"
              value={config.entry_offset_percent?.toString() || ''}
              onChange={(e) => onNumberInput('entry_offset_percent', parseFloat(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Risk Management */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              value={config.max_drawdown_percent?.toString() || ''}
              onChange={(e) => onNumberInput('max_drawdown_percent', parseFloat(e.target.value))}
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
        </CardContent>
      </Card>

      {/* Trading Pairs */}
      <Card>
        <CardHeader>
          <CardTitle>Trading Pairs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Trading Pairs</Label>
            <Select onValueChange={(value) => handleTradingPairsChange(value.split(','))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select pairs" defaultValue={config.trading_pairs?.join(',')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,ADAUSDT">BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, ADAUSDT</SelectItem>
                <SelectItem value="BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,ADAUSDT,XRPUSDT,LTCUSDT,DOGEUSDT,MATICUSDT,FETUSDT,POLUSDT,XLMUSDT">All Available</SelectItem>
                <SelectItem value="BTCUSDT">BTCUSDT</SelectItem>
                <SelectItem value="ETHUSDT">ETHUSDT</SelectItem>
                <SelectItem value="SOLUSDT">SOLUSDT</SelectItem>
                <SelectItem value="BNBUSDT">BNBUSDT</SelectItem>
                <SelectItem value="ADAUSDT">ADAUSDT</SelectItem>
                <SelectItem value="XRPUSDT">XRPUSDT</SelectItem>
                <SelectItem value="LTCUSDT">LTCUSDT</SelectItem>
                <SelectItem value="DOGEUSDT">DOGEUSDT</SelectItem>
                <SelectItem value="MATICUSDT">MATICUSDT</SelectItem>
                <SelectItem value="FETUSDT">FETUSDT</SelectItem>
                <SelectItem value="POLUSDT">POLUSDT</SelectItem>
                <SelectItem value="XLMUSDT">XLMUSDT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* New Decimal Configuration Section */}
      <DecimalConfigSection
        config={config}
        onInputChange={onInputChange}
      />

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Trading strategy notes..."
              value={config.notes || ''}
              onChange={(e) => onInputChange('notes', e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={config.is_active || false}
              onCheckedChange={(checked) => onInputChange('is_active', checked)}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TradingConfigForm;
