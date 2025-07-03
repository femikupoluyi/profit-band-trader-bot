
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
import { TrendingUp, Loader2 } from 'lucide-react';
import { ActiveTrade } from '@/types/trading';
import ActiveTradeRow from './ActiveTradeRow';
import ActiveTradesSummary from './ActiveTradesSummary';
import BybitSyncButton from '../trading/BybitSyncButton';
import { useActiveTrades } from '@/hooks/useActiveTrades';

interface ActivePairsTableProps {
  onTradeUpdate?: () => void;
}

const ActivePairsTable = ({ onTradeUpdate }: ActivePairsTableProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [closingTrades, setClosingTrades] = useState<Set<string>>(new Set());
  
  // Disable auto-refresh for better performance - only manual refresh
  const { activeTrades, isLoading, refetch } = useActiveTrades(false);

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
            {/* Show manual refresh indicator */}
            <span className="text-xs text-muted-foreground bg-blue-100 px-2 py-1 rounded">
              Manual refresh only
            </span>
          </div>
          <BybitSyncButton onSyncComplete={handleSyncComplete} />
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
