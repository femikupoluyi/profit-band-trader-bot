
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TradingConfigData } from '../types/configTypes';

interface PositionManagementProps {
  config: TradingConfigData;
  onNumberInput: (field: keyof TradingConfigData, value: number) => void;
  onIntegerInput: (field: keyof TradingConfigData, value: number) => void;
}

const PositionManagement: React.FC<PositionManagementProps> = ({
  config,
  onNumberInput,
  onIntegerInput
}) => {
  return (
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
  );
};

export default PositionManagement;
