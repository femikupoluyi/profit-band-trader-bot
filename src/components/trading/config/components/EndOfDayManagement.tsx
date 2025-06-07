
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TradingConfigData } from '../types/configTypes';

interface EndOfDayManagementProps {
  config: TradingConfigData;
  onInputChange: (field: keyof TradingConfigData, value: any) => void;
  onNumberInput: (field: keyof TradingConfigData, value: number) => void;
}

const EndOfDayManagement: React.FC<EndOfDayManagementProps> = ({
  config,
  onInputChange,
  onNumberInput
}) => {
  return (
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
  );
};

export default EndOfDayManagement;
