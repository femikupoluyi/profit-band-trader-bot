
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RefreshCw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter pairs based on search term
  const filteredPairs = availablePairs.filter(pair =>
    pair.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fetch trading pairs on component mount
  useEffect(() => {
    fetchPairs();
  }, []);

  const fetchPairs = async () => {
    setIsLoading(true);
    try {
      const pairs = await TradingPairsService.fetchActiveTradingPairs(new BybitService('', ''));
      setAvailablePairs(pairs);
      console.log(`📊 Loaded ${pairs.length} trading pairs`);
    } catch (error) {
      console.error('Failed to fetch trading pairs:', error);
      // Use current pairs if available as fallback
      setAvailablePairs(TradingPairsService.getCurrentPairs());
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const pairs = await TradingPairsService.refreshTradingPairs(new BybitService('', ''));
      setAvailablePairs(pairs);
      console.log(`🔄 Refreshed ${pairs.length} trading pairs`);
    } catch (error) {
      console.error('Failed to refresh trading pairs:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleSelectAll = () => {
    onInputChange('trading_pairs', [...filteredPairs]);
  };

  const handleDeselectAll = () => {
    onInputChange('trading_pairs', []);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Trading Pairs Selection</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search trading pairs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Bulk Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={isLoading}
          >
            Select All ({filteredPairs.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeselectAll}
            disabled={isLoading}
          >
            Deselect All
          </Button>
        </div>

        {/* Trading Pairs Grid */}
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading trading pairs...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
            {filteredPairs.map((pair) => (
              <div key={pair} className="flex items-center space-x-2">
                <Checkbox
                  id={`pair-${pair}`}
                  checked={config.trading_pairs?.includes(pair) || false}
                  onCheckedChange={(checked) => handleTradingPairToggle(pair, checked as boolean)}
                />
                <Label htmlFor={`pair-${pair}`} className="text-sm font-medium cursor-pointer">
                  {pair}
                </Label>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between text-sm text-gray-600">
          <span>Available pairs: {filteredPairs.length} / {availablePairs.length}</span>
          <span>Selected pairs: {config.trading_pairs?.length || 0}</span>
        </div>

        {searchTerm && filteredPairs.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No trading pairs match "{searchTerm}"
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradingPairsSelection;
