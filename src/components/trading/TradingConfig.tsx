
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

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

interface TradingConfigProps {
  onConfigUpdate?: () => void;
}

const TradingConfig: React.FC<TradingConfigProps> = ({ onConfigUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<TradingConfigData>({
    min_profit_percent: 5.0,
    max_active_pairs: 5,
    max_order_amount_usd: 100.0,
    max_portfolio_exposure_percent: 25.0,
    daily_reset_time: '00:00:00',
    chart_timeframe: '4h',
    buy_range_lower_offset: -1.5,
    buy_range_upper_offset: 1.0,
    sell_range_offset: 5.5,
    is_active: false,
  });

  useEffect(() => {
    if (user) {
      fetchConfig();
    }
  }, [user]);

  const fetchConfig = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('trading_configs')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig({
          min_profit_percent: parseFloat(data.min_profit_percent) || 5.0,
          max_active_pairs: data.max_active_pairs || 5,
          max_order_amount_usd: parseFloat(data.max_order_amount_usd) || 100.0,
          max_portfolio_exposure_percent: parseFloat(data.max_portfolio_exposure_percent) || 25.0,
          daily_reset_time: data.daily_reset_time || '00:00:00',
          chart_timeframe: data.chart_timeframe || '4h',
          buy_range_lower_offset: parseFloat(data.buy_range_lower_offset) || -1.5,
          buy_range_upper_offset: parseFloat(data.buy_range_upper_offset) || 1.0,
          sell_range_offset: parseFloat(data.sell_range_offset) || 5.5,
          is_active: data.is_active || false,
        });
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      toast({
        title: "Error",
        description: "Failed to load trading configuration.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('trading_configs')
        .upsert({
          user_id: user.id,
          ...config,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Trading configuration saved successfully.",
      });

      if (onConfigUpdate) {
        onConfigUpdate();
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: "Failed to save trading configuration.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof TradingConfigData, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNumberInput = (field: keyof TradingConfigData, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      handleInputChange(field, numValue);
    } else if (value === '') {
      // Allow empty string temporarily while user is typing
      handleInputChange(field, 0);
    }
  };

  const handleIntegerInput = (field: keyof TradingConfigData, value: string) => {
    const intValue = parseInt(value);
    if (!isNaN(intValue)) {
      handleInputChange(field, intValue);
    } else if (value === '') {
      // Allow empty string temporarily while user is typing
      handleInputChange(field, 0);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Configuration</CardTitle>
        <CardDescription>
          Configure your automated trading bot parameters and risk management settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bot Status */}
          <div className="space-y-2">
            <Label>Bot Status</Label>
            <div className="flex items-center space-x-2">
              <Switch
                checked={config.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
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
              onChange={(e) => handleNumberInput('min_profit_percent', e.target.value)}
            />
          </div>

          {/* Max Active Pairs */}
          <div className="space-y-2">
            <Label htmlFor="max_active_pairs">Maximum Active Pairs</Label>
            <Input
              id="max_active_pairs"
              type="number"
              value={config.max_active_pairs}
              onChange={(e) => handleIntegerInput('max_active_pairs', e.target.value)}
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
              onChange={(e) => handleNumberInput('max_order_amount_usd', e.target.value)}
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
              onChange={(e) => handleNumberInput('max_portfolio_exposure_percent', e.target.value)}
            />
          </div>

          {/* Chart Timeframe */}
          <div className="space-y-2">
            <Label>Chart Timeframe</Label>
            <Select
              value={config.chart_timeframe}
              onValueChange={(value) => handleInputChange('chart_timeframe', value)}
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
              onChange={(e) => handleInputChange('daily_reset_time', e.target.value)}
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
              onChange={(e) => handleNumberInput('buy_range_lower_offset', e.target.value)}
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
              onChange={(e) => handleNumberInput('buy_range_upper_offset', e.target.value)}
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
              onChange={(e) => handleNumberInput('sell_range_offset', e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TradingConfig;
