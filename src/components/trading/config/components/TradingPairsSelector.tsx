
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

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
  
  // Common trading pairs
  const availablePairs = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT',
    'XRPUSDT', 'DOTUSDT', 'LTCUSDT', 'LINKUSDT', 'UNIUSDT',
    'MATICUSDT', 'AVAXUSDT', 'ATOMUSDT', 'FTMUSDT', 'ALGOUSDT',
    'XLMUSDT', 'VETUSDT', 'ICPUSDT', 'FILUSDT', 'TRXUSDT'
  ];

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Pairs Selection</CardTitle>
        <CardDescription>
          Select the cryptocurrency pairs you want to trade. Maximum active pairs: {maxActive}
        </CardDescription>
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
          >
            Select All ({filteredPairs.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeselectAll}
          >
            Deselect All
          </Button>
        </div>

        {/* Trading Pairs Grid */}
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

        <div className="flex justify-between text-sm text-gray-600">
          <span>Available pairs: {filteredPairs.length} / {availablePairs.length}</span>
          <span>Selected pairs: {selectedPairs.length}</span>
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

export default TradingPairsSelector;
