
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TradingConfigData } from './useTradingConfig';

interface DecimalConfigSectionProps {
  config: TradingConfigData;
  onInputChange: (field: keyof TradingConfigData, value: any) => void;
  availablePairs?: string[];
}

const DecimalConfigSection: React.FC<DecimalConfigSectionProps> = ({
  config,
  onInputChange,
  availablePairs
}) => {
  const supportedPairs = availablePairs || [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 
    'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'MATICUSDT', 'FETUSDT', 
    'POLUSDT', 'XLMUSDT'
  ];

  const handlePriceDecimalChange = (symbol: string, value: string) => {
    const decimals = parseInt(value) || 0;
    const updated = {
      ...config.price_decimals_per_symbol,
      [symbol]: decimals
    };
    onInputChange('price_decimals_per_symbol', updated);
  };

  const handleQuantityDecimalChange = (symbol: string, value: string) => {
    const decimals = parseInt(value) || 0;
    const updated = {
      ...config.quantity_decimals_per_symbol,
      [symbol]: decimals
    };
    onInputChange('quantity_decimals_per_symbol', updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decimal Precision Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground mb-4">
          Configure the number of decimal places for prices and quantities per symbol to avoid Bybit API errors.
        </div>
        
        <div className="space-y-4">
          {supportedPairs.map(symbol => (
            <div key={symbol} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-3 border rounded-lg">
              <div className="font-medium">{symbol}</div>
              
              <div className="space-y-2">
                <Label htmlFor={`price-${symbol}`} className="text-xs">Price Decimals</Label>
                <Input
                  id={`price-${symbol}`}
                  type="number"
                  min="0"
                  max="8"
                  value={config.price_decimals_per_symbol?.[symbol] || ''}
                  onChange={(e) => handlePriceDecimalChange(symbol, e.target.value)}
                  placeholder="Auto"
                  className="h-8"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`qty-${symbol}`} className="text-xs">Quantity Decimals</Label>
                <Input
                  id={`qty-${symbol}`}
                  type="number"
                  min="0"
                  max="8"
                  value={config.quantity_decimals_per_symbol?.[symbol] || ''}
                  onChange={(e) => handleQuantityDecimalChange(symbol, e.target.value)}
                  placeholder="Auto"
                  className="h-8"
                />
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm font-medium text-blue-900">💡 Tips:</div>
          <ul className="text-xs text-blue-700 mt-1 space-y-1">
            <li>• Leave blank to use automatic defaults</li>
            <li>• If you get "too many decimals" errors, reduce the decimal count</li>
            <li>• Check Bybit's symbol info for exact requirements</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default DecimalConfigSection;
