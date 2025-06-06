
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TradingConfigData } from '../types/configTypes';
import { TradingPairsService } from '@/services/trading/core/TradingPairsService';
import { BybitService } from '@/services/bybitService';

interface TradingPairsSelectionProps {
  config: TradingConfigData;
  onInputChange: (field: keyof TradingConfigData, value: any) => void;
}

const TradingPairsSelection: React.FC<TradingPairsSelectionProps> = ({
  config,
  onInputChange
}) => {
  const [availablePairs, setAvailablePairs] = useState<string[]>([]);
  
  // Fetch active trading pairs when the component mounts
  useEffect(() => {
    const fetchPairs = async () => {
      try {
        const pairs = await TradingPairsService.fetchActiveTradingPairs(new BybitService('', ''));
        setAvailablePairs(pairs);
      } catch (error) {
        console.error('Failed to fetch trading pairs:', error);
        // Use current pairs if available as fallback
        setAvailablePairs(TradingPairsService.getCurrentPairs());
      }
    };

    fetchPairs();
  }, []);

  const handleTradingPairToggle = (pair: string, checked: boolean) => {
    const currentPairs = config.trading_pairs || [];
    if (checked) {
      if (!currentPairs.includes(pair)) {
        onInputChange('trading_pairs', [...currentPairs, pair]);
      }
    } else {
      onInputChange('trading_pairs', currentPairs.filter(p => p !== pair));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Pairs Selection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {availablePairs.map((pair) => (
            <div key={pair} className="flex items-center space-x-2">
              <Checkbox
                id={`pair-${pair}`}
                checked={config.trading_pairs?.includes(pair) || false}
                onCheckedChange={(checked) => handleTradingPairToggle(pair, checked as boolean)}
              />
              <Label htmlFor={`pair-${pair}`} className="text-sm font-medium">
                {pair}
              </Label>
            </div>
          ))}
        </div>
        <div className="text-sm text-gray-600">
          Selected pairs: {config.trading_pairs?.length || 0} / {availablePairs.length}
        </div>
      </CardContent>
    </Card>
  );
};

export default TradingPairsSelection;
