
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TradingConfigData } from '../types/configTypes';

interface SystemConfigurationProps {
  config: TradingConfigData;
  onInputChange: (field: keyof TradingConfigData, value: any) => void;
  onIntegerInput: (field: keyof TradingConfigData, value: number) => void;
}

const SystemConfiguration: React.FC<SystemConfigurationProps> = ({
  config,
  onInputChange,
  onIntegerInput
}) => {
  return (
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
  );
};

export default SystemConfiguration;
