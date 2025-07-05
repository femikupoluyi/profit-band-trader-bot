
import React from 'react';
import { useActiveTrades } from '@/hooks/useActiveTrades';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BybitSyncButton from '@/components/trading/BybitSyncButton';
import EmergencySyncButton from '@/components/trading/EmergencySyncButton';

interface ActiveTradesProps {
  onTradeUpdate?: () => void;
}

const ActiveTrades = ({ onTradeUpdate }: ActiveTradesProps) => {
  // Explicitly disable auto-refresh for this component
  const { activeTrades, isLoading, refetch } = useActiveTrades(false);

  const handleRefresh = () => {
    console.log('🔄 Manual refresh of active trades');
    refetch();
    if (onTradeUpdate) {
      onTradeUpdate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Active Trades Overview
            <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded">
              Manual refresh
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <EmergencySyncButton onSyncComplete={handleRefresh} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading...
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Active Trades:</span>
              <span className="font-medium">{activeTrades.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Active Pairs:</span>
              <span className="font-medium">
                {new Set(activeTrades.filter(t => t.status === 'filled').map(t => t.symbol)).size}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Unrealized P&L:</span>
              <span className={`font-medium ${
                activeTrades.reduce((sum, trade) => sum + (trade.unrealizedPL || 0), 0) >= 0 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                ${activeTrades.reduce((sum, trade) => sum + (trade.unrealizedPL || 0), 0).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActiveTrades;
