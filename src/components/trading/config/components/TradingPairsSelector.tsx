
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw } from 'lucide-react';
import { TradingPairsService } from '@/services/trading/core/TradingPairsService';
import { BybitService } from '@/services/bybitService';

interface TradingPairsSelectorProps {
  selectedPairs: string[];
  onPairsChange: (pairs: string[]) => void;
  maxActive: number;
}

const TradingPairsSelector: React.FC<TradingPairsSelectorProps> = ({
  selectedPairs,
  onPairsChange,
  maxActive
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [availablePairs, setAvailablePairs] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Fetch trading pairs on component mount
  React.useEffect(() => {
    fetchTradingPairs();
  }, []);

  const fetchTradingPairs = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Fetching latest trading pairs from Bybit...');
      const pairs = await TradingPairsService.fetchActiveTradingPairs(new BybitService('', ''));
      console.log(`✅ Fetched ${pairs.length} trading pairs from Bybit`);
      setAvailablePairs(pairs);
    } catch (error) {
      console.error('❌ Failed to fetch trading pairs:', error);
      // Use cached pairs as fallback
      const cachedPairs = TradingPairsService.getCurrentPairs();
      setAvailablePairs(cachedPairs);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPairs = availablePairs.filter(pair =>
    pair.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePairToggle = (pair: string, checked: boolean) => {
    if (checked) {
      if (!selectedPairs.includes(pair)) {
        onPairsChange([...selectedPairs, pair]);
      }
    } else {
      onPairsChange(selectedPairs.filter(p => p !== pair));
    }
  };

  const handleSelectAll = () => {
    onPairsChange([...filteredPairs]);
  };

  const handleDeselectAll = () => {
    onPairsChange([]);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const pairs = await TradingPairsService.refreshTradingPairs(new BybitService('', ''));
      setAvailablePairs(pairs);
      console.log(`🔄 Refreshed ${pairs.length} trading pairs`);
    } catch (error) {
      console.error('❌ Failed to refresh trading pairs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Trading Pairs Selection</CardTitle>
            <CardDescription>
              Select the cryptocurrency pairs you want to trade. Maximum active pairs: {maxActive}
            </CardDescription>
          </div>
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

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading latest trading pairs from Bybit...</p>
          </div>
        )}

        {/* Trading Pairs Grid */}
        {!isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
            {filteredPairs.map((pair) => (
              <div key={pair} className="flex items-center space-x-2">
                <Checkbox
                  id={`pair-${pair}`}
                  checked={selectedPairs.includes(pair)}
                  onCheckedChange={(checked) => handlePairToggle(pair, checked as boolean)}
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
          <span>Selected pairs: {selectedPairs.length}</span>
        </div>

        {searchTerm && filteredPairs.length === 0 && !isLoading && (
          <div className="text-center py-4 text-gray-500">
            No trading pairs match "{searchTerm}"
          </div>
        )}

        {!isLoading && availablePairs.length === 0 && (
          <div className="text-center py-4 text-yellow-600">
            <p>No trading pairs loaded. Try refreshing to fetch the latest pairs from Bybit.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradingPairsSelector;
