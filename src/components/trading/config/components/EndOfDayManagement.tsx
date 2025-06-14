
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
  // Convert HH:MM:SS to HH:MM for HTML time input
  const formatTimeForInput = (timeStr: string): string => {
    if (!timeStr) return '00:00';
    
    // If it's HH:MM:SS, convert to HH:MM
    if (timeStr.includes(':') && timeStr.split(':').length === 3) {
      const parts = timeStr.split(':');
      return `${parts[0]}:${parts[1]}`;
    }
    
    // If it's already HH:MM, return as is
    if (timeStr.includes(':') && timeStr.split(':').length === 2) {
      return timeStr;
    }
    
    return '00:00';
  };

  // Convert HH:MM from HTML input to HH:MM:SS for database
  const handleTimeChange = (timeValue: string) => {
    if (timeValue && timeValue.includes(':')) {
      const timeWithSeconds = timeValue + ':00';
      onInputChange('daily_reset_time', timeWithSeconds);
    } else {
      onInputChange('daily_reset_time', '00:00:00');
    }
  };

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
              value={formatTimeForInput(config.daily_reset_time || '00:00:00')}
              onChange={(e) => handleTimeChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Time when daily trading cycle resets (24-hour format)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eod_close_premium_percent">EOD Close Premium (%)</Label>
            <Input
              id="eod_close_premium_percent"
              type="number"
              step="0.01"
              min="0"
              max="5"
              value={config.eod_close_premium_percent?.toString() || ''}
              onChange={(e) => onNumberInput('eod_close_premium_percent', parseFloat(e.target.value) || 0.1)}
            />
            <p className="text-xs text-muted-foreground">
              Minimum profit % required to close positions at end of day
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual_close_premium_percent">Manual Close Premium (%)</Label>
            <Input
              id="manual_close_premium_percent"
              type="number"
              step="0.01"
              min="0"
              max="5"
              value={config.manual_close_premium_percent?.toString() || ''}
              onChange={(e) => onNumberInput('manual_close_premium_percent', parseFloat(e.target.value) || 0.1)}
            />
            <p className="text-xs text-muted-foreground">
              Minimum profit % required for manual position closing
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EndOfDayManagement;
