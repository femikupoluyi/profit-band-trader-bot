
import React, { useState, useEffect } from 'react';
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
import { getTradeEntryPrice, getTradeVolume } from '@/utils/formatters';

interface ActivePairsTableProps {
  onTradeUpdate?: () => void;
}

const ActivePairsTable = ({ onTradeUpdate }: ActivePairsTableProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [closingTrades, setClosingTrades] = useState<Set<string>>(new Set());

  const calculateActualPL = async (trade: any) => {
    if (!trade) return { currentPrice: 0, unrealizedPL: 0 };
    
    try {
      const entryPrice = getTradeEntryPrice(trade);
      const quantity = parseFloat(trade.quantity?.toString() || '0');

      if (!entryPrice || !quantity || quantity <= 0) {
        return { currentPrice: entryPrice || 0, unrealizedPL: 0 };
      }

      // Get current market price for P&L calculation
      const { data: marketData } = await supabase
        .from('market_data')
        .select('price')
        .eq('symbol', trade.symbol)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (marketData && marketData.price) {
        const currentPrice = parseFloat(marketData.price.toString());
        
        if (!isNaN(currentPrice) && currentPrice > 0) {
          // Calculate actual P&L based on trade side
          if (trade.side === 'buy') {
            return {
              currentPrice,
              unrealizedPL: (currentPrice - entryPrice) * quantity
            };
          } else {
            return {
              currentPrice,
              unrealizedPL: (entryPrice - currentPrice) * quantity
            };
          }
        }
      }

      return {
        currentPrice: entryPrice,
        unrealizedPL: 0
      };
    } catch (error) {
      console.error(`Error calculating actual P&L for trade ${trade.id}:`, error);
      return {
        currentPrice: getTradeEntryPrice(trade),
        unrealizedPL: 0
      };
    }
  };

  const fetchActiveTrades = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      console.log('Fetching active trades for user:', user.id);

      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'filled'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching active trades:', error);
        toast({
          title: "Error",
          description: "Failed to fetch active trades.",
          variant: "destructive",
        });
        return;
      }

      const tradesWithActualPL = await Promise.all(
        (trades || []).map(async (trade) => {
          try {
            const entryPrice = getTradeEntryPrice(trade);
            const quantity = parseFloat(trade.quantity?.toString() || '0');
            const volume = getTradeVolume(trade);

            const { currentPrice, unrealizedPL } = await calculateActualPL(trade);
            
            console.log(`Trade ${trade.symbol}: Entry=$${entryPrice}, Current=$${currentPrice}, Qty=${quantity}, Actual Unrealized P&L=$${unrealizedPL.toFixed(2)}`);

            return {
              ...trade,
              price: entryPrice,
              quantity,
              profit_loss: 0, // Active trades don't have realized P&L
              currentPrice,
              unrealizedPL,
              volume,
            };
          } catch (error) {
            console.error(`Error processing trade ${trade.id}:`, error);
            const entryPrice = getTradeEntryPrice(trade);
            const quantity = parseFloat(trade.quantity?.toString() || '0');
            return {
              ...trade,
              price: entryPrice,
              quantity,
              profit_loss: 0,
              currentPrice: entryPrice,
              unrealizedPL: 0,
              volume: getTradeVolume(trade),
            };
          }
        })
      );

      console.log('Active trades with actual P&L:', tradesWithActualPL);
      setActiveTrades(tradesWithActualPL);
    } catch (error) {
      console.error('Error fetching active trades:', error);
      toast({
        title: "Error",
        description: "Failed to fetch active trades.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseTrade = async (trade: ActiveTrade) => {
    if (!trade?.id || !user?.id) {
      toast({
        title: "Error",
        description: "Invalid trade or user data.",
        variant: "destructive",
      });
      return;
    }

    setClosingTrades(prev => new Set(prev).add(trade.id));
    
    try {
      console.log('Manually closing trade:', trade.id);

      // Use the current actual unrealized P&L as the final P&L
      const finalPL = trade.unrealizedPL || 0;

      // Update trade status to closed with final P&L
      const { error: updateError } = await supabase
        .from('trades')
        .update({
          status: 'closed',
          profit_loss: finalPL,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trade.id)
        .eq('user_id', user.id); // Ensure user can only close their own trades

      if (updateError) {
        console.error('Error closing trade:', updateError);
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
          user_id: user.id,
          log_type: 'position_closed',
          message: `Manually closed ${trade.symbol} position`,
          data: {
            tradeId: trade.id,
            symbol: trade.symbol,
            finalPL,
            closeType: 'manual'
          },
        });

      toast({
        title: "Trade Closed",
        description: `Successfully closed ${trade.symbol} position with ${finalPL >= 0 ? 'profit' : 'loss'} of $${Math.abs(finalPL).toFixed(2)}`,
      });

      // Refresh the trades list
      await fetchActiveTrades();
      
      // Notify parent component to refresh dashboard stats
      if (onTradeUpdate) {
        onTradeUpdate();
      }
    } catch (error) {
      console.error('Error closing trade:', error);
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

  useEffect(() => {
    if (user?.id) {
      fetchActiveTrades();
      
      // Refresh every 30 seconds
      const interval = setInterval(fetchActiveTrades, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  if (!user?.id) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Please log in to view active trades</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Active Trading Pairs
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
            No active trades found
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
