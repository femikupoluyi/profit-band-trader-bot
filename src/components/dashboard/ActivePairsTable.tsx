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

interface ActivePairsTableProps {
  onTradeUpdate?: () => void;
}

const ActivePairsTable = ({ onTradeUpdate }: ActivePairsTableProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [closingTrades, setClosingTrades] = useState<Set<string>>(new Set());

  const fetchActiveTrades = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      console.log('Fetching active trades for user:', user.id);

      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'filled']) // Removed 'cancelled' from active trades
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

      const tradesWithPL = await Promise.all(
        (trades || []).map(async (trade) => {
          try {
            // Get current market price for P&L calculation
            const { data: marketData, error: priceError } = await supabase
              .from('market_data')
              .select('price')
              .eq('symbol', trade.symbol)
              .order('timestamp', { ascending: false })
              .limit(1)
              .maybeSingle();

            let unrealizedPL = 0;
            let currentPrice = trade.price;

            if (!priceError && marketData) {
              currentPrice = parseFloat(marketData.price.toString());
              const entryPrice = parseFloat(trade.price.toString());
              const quantity = parseFloat(trade.quantity.toString());
              
              if (trade.side === 'buy') {
                unrealizedPL = (currentPrice - entryPrice) * quantity;
              } else {
                unrealizedPL = (entryPrice - currentPrice) * quantity;
              }
            }

            const entryPrice = parseFloat(trade.price.toString());
            const quantity = parseFloat(trade.quantity.toString());
            const volume = entryPrice * quantity;

            return {
              ...trade,
              price: entryPrice,
              quantity,
              profit_loss: trade.profit_loss ? parseFloat(trade.profit_loss.toString()) : 0,
              currentPrice,
              unrealizedPL,
              volume,
            };
          } catch (error) {
            console.error(`Error processing trade ${trade.id}:`, error);
            const entryPrice = parseFloat(trade.price.toString());
            const quantity = parseFloat(trade.quantity.toString());
            return {
              ...trade,
              price: entryPrice,
              quantity,
              profit_loss: trade.profit_loss ? parseFloat(trade.profit_loss.toString()) : 0,
              currentPrice: entryPrice,
              unrealizedPL: 0,
              volume: entryPrice * quantity,
            };
          }
        })
      );

      console.log('Active trades with P&L:', tradesWithPL);
      setActiveTrades(tradesWithPL);
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
    setClosingTrades(prev => new Set(prev).add(trade.id));
    
    try {
      console.log('Manually closing trade:', trade.id);

      // Calculate final P&L
      const finalPL = trade.unrealizedPL || 0;

      // Update trade status to cancelled (which is a valid status) with final P&L
      const { error: updateError } = await supabase
        .from('trades')
        .update({
          status: 'cancelled', // Changed from 'closed' to 'cancelled'
          profit_loss: finalPL,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trade.id);

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
          user_id: user?.id,
          log_type: 'trade',
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
