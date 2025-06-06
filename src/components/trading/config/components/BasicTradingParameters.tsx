
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TradingConfigData } from '../types/configTypes';

interface BasicTradingParametersProps {
  config: TradingConfigData;
  onNumberInput: (field: keyof TradingConfigData, value: number) => void;
}

const BasicTradingParameters: React.FC<BasicTradingParametersProps> = ({
  config,
  onNumberInput
}) => {
  return (
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
  );
};

export default BasicTradingParameters;
