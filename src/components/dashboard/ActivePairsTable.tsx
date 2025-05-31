
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TrendingUp, Loader2, X } from 'lucide-react';

interface ActiveTrade {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  side: string;
  status: string;
  created_at: string;
  profit_loss: number;
  currentPrice?: number;
  unrealizedPL?: number;
}

const ActivePairsTable = () => {
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

            return {
              ...trade,
              price: parseFloat(trade.price.toString()),
              quantity: parseFloat(trade.quantity.toString()),
              profit_loss: trade.profit_loss ? parseFloat(trade.profit_loss.toString()) : 0,
              currentPrice,
              unrealizedPL,
            };
          } catch (error) {
            console.error(`Error processing trade ${trade.id}:`, error);
            return {
              ...trade,
              price: parseFloat(trade.price.toString()),
              quantity: parseFloat(trade.quantity.toString()),
              profit_loss: trade.profit_loss ? parseFloat(trade.profit_loss.toString()) : 0,
              currentPrice: parseFloat(trade.price.toString()),
              unrealizedPL: 0,
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

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatPercentage = (entry: number, current: number) => {
    if (entry === 0) return '0.00%';
    const percentage = ((current - entry) / entry) * 100;
    return `${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

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
                  <TableHead>Unrealized P&L</TableHead>
                  <TableHead>% Change</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTrades.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell className="font-medium">{trade.symbol}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.side === 'buy' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {trade.side.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>{trade.quantity.toFixed(8)}</TableCell>
                    <TableCell>{formatCurrency(trade.price)}</TableCell>
                    <TableCell>{formatCurrency(trade.currentPrice || trade.price)}</TableCell>
                    <TableCell>
                      <span className={`font-medium ${
                        (trade.unrealizedPL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(trade.unrealizedPL || 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${
                        (trade.currentPrice || trade.price) >= trade.price ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatPercentage(trade.price, trade.currentPrice || trade.price)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.status === 'filled' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {trade.status.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={closingTrades.has(trade.id)}
                            className="h-8 w-8 p-0"
                          >
                            {closingTrades.has(trade.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Close Trade</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to manually close this {trade.symbol} position?
                              <br />
                              <br />
                              <strong>Current P&L:</strong> <span className={`font-medium ${
                                (trade.unrealizedPL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(trade.unrealizedPL || 0)}
                              </span>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleCloseTrade(trade)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Close Position
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivePairsTable;
