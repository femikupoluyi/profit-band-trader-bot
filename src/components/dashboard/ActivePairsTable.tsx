
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActiveTrade } from '@/types/trading';
import ActiveTradeRow from './ActiveTradeRow';
import ActiveTradesSummary from './ActiveTradesSummary';
import BybitSyncButton from '../trading/BybitSyncButton';
import { useActiveTrades } from '@/hooks/useActiveTrades';

interface ActivePairsTableProps {
  onTradeUpdate?: () => void;
  timeRange?: { from: Date; to: Date };
}

const ActivePairsTable = ({ onTradeUpdate, timeRange }: ActivePairsTableProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [closingTrades, setClosingTrades] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Use controlled auto-refresh based on user preference
  const { activeTrades, isLoading, refetch } = useActiveTrades(autoRefresh);

  const handleCloseTrade = async (trade: ActiveTrade) => {
    setClosingTrades(prev => new Set(prev).add(trade.id));
    
    try {
      console.log('🔒 Manually closing trade:', trade.id);

      // Use the current actual unrealized P&L as the final P&L (only for filled orders)
      const finalPL = trade.status === 'filled' ? (trade.unrealizedPL || 0) : 0;

      // Update trade status to closed with final P&L
      const { error: updateError } = await supabase
        .from('trades')
        .update({
          status: 'closed',
          profit_loss: finalPL,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trade.id);

      if (updateError) {
        console.error('❌ Error closing trade:', updateError);
        toast({
          title: "Error",
          description: "Failed to close trade.",
          variant: "destructive",
        });
        return;
      }

      // Log the manual close action
      await supabase
        .from('trading_logs')
        .insert({
          user_id: user?.id,
          log_type: 'position_closed',
          message: `Manually closed ${trade.symbol} position`,
          data: {
            tradeId: trade.id,
            symbol: trade.symbol,
            finalPL,
            closeType: 'manual',
            wasFilled: trade.status === 'filled'
          },
        });

      const plMessage = trade.status === 'filled' 
        ? `with ${finalPL >= 0 ? 'profit' : 'loss'} of $${Math.abs(finalPL).toFixed(2)}`
        : 'with no P&L (unfilled order)';

      toast({
        title: "Trade Closed",
        description: `Successfully closed ${trade.symbol} position ${plMessage}`,
      });

      // Refresh the trades list
      await refetch();
      
      // Notify parent component to refresh dashboard stats
      if (onTradeUpdate) {
        onTradeUpdate();
      }
    } catch (error) {
      console.error('❌ Error closing trade:', error);
      toast({
        title: "Error",
        description: "Failed to close trade.",
        variant: "destructive",
      });
    } finally {
      setClosingTrades(prev => {
        const newSet = new Set(prev);
        newSet.delete(trade.id);
        return newSet;
      });
    }
  };

  const handleSyncComplete = () => {
    console.log('🔄 Sync completed, refreshing active trades...');
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
            Active Trading Pairs
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs">
                <input 
                  type="checkbox" 
                  checked={autoRefresh} 
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                Auto-refresh data (30s)
              </label>
              <span className={`text-xs px-2 py-1 rounded ${autoRefresh ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {autoRefresh ? 'UI refresh: ON' : 'Manual refresh only'}
              </span>
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                ⚠️ This only refreshes UI data, not trading logic
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BybitSyncButton onSyncComplete={handleSyncComplete} timeRange={timeRange} />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => { refetch(); handleSyncComplete(); }}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh UI
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading active trades...</span>
          </div>
        ) : activeTrades.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-4">No active trades found.</p>
            <p className="text-sm">Click "Sync from Bybit" to import your latest trades.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Entry Price</TableHead>
                  <TableHead>Current Price</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Unrealized P&L</TableHead>
                  <TableHead>% Change</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTrades.map((trade) => (
                  <ActiveTradeRow
                    key={trade.id}
                    trade={trade}
                    isClosing={closingTrades.has(trade.id)}
                    onClose={handleCloseTrade}
                  />
                ))}
              </TableBody>
              <TableFooter>
                <ActiveTradesSummary trades={activeTrades} />
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivePairsTable;
