
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, calculateSideAwarePL, calculateSideAwarePercentage, shouldShowPL } from '@/utils/formatters';
import { Loader2 } from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: string;
  price: number;
  quantity: number;
  status: string;
  profit_loss: number | null;
  created_at: string;
  updated_at: string;
  bybit_order_id: string | null;
}

const TradesReport = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (user) {
      fetchTrades();
      fetchMarketPrices();
    }
  }, [user]);

  const fetchTrades = async () => {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching trades:', error);
        return;
      }

      // Type assertion to ensure side is properly typed
      const typedTrades = (data || []).map(trade => ({
        ...trade,
        side: trade.side as 'buy' | 'sell'
      }));

      setTrades(typedTrades);
    } catch (error) {
      console.error('Error fetching trades:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMarketPrices = async () => {
    try {
      // Get unique symbols from trades
      const symbols = [...new Set(trades.map(trade => trade.symbol))];
      
      const pricePromises = symbols.map(async (symbol) => {
        const { data } = await supabase
          .from('market_data')
          .select('price')
          .eq('symbol', symbol)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        return { symbol, price: data?.price || 0 };
      });

      const prices = await Promise.all(pricePromises);
      const priceMap = prices.reduce((acc, { symbol, price }) => {
        acc[symbol] = parseFloat(price.toString());
        return acc;
      }, {} as Record<string, number>);

      setMarketPrices(priceMap);
    } catch (error) {
      console.error('Error fetching market prices:', error);
    }
  };

  // Refresh market prices when trades change
  useEffect(() => {
    if (trades.length > 0) {
      fetchMarketPrices();
    }
  }, [trades]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'filled':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'closed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSideColor = (side: string) => {
    return side === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  // Calculate P&L and percentage for each trade using side-aware logic
  const getTradeMetrics = (trade: Trade) => {
    const currentPrice = marketPrices[trade.symbol] || trade.price;
    
    // Check if we should show P&L for this trade
    if (shouldShowPL(trade, undefined)) {
      const pnl = calculateSideAwarePL(trade.side, trade.price, currentPrice, trade.quantity);
      const percentage = calculateSideAwarePercentage(trade.side, trade.price, currentPrice);
      
      return {
        showPL: true,
        pnl,
        percentage,
        currentPrice
      };
    }

    // For closed trades, use stored profit_loss
    if (trade.status === 'closed' && trade.profit_loss !== null) {
      const volume = trade.price * trade.quantity;
      const percentage = volume > 0 ? (trade.profit_loss / volume) * 100 : 0;
      
      return {
        showPL: true,
        pnl: trade.profit_loss,
        percentage,
        currentPrice: trade.price // Use entry price for closed trades
      };
    }

    return {
      showPL: false,
      pnl: 0,
      percentage: 0,
      currentPrice
    };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trades Report</CardTitle>
          <CardDescription>Complete trading history and performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate summary statistics using side-aware P&L logic
  const activeTrades = trades.filter(trade => shouldShowPL(trade, undefined));
  const closedTrades = trades.filter(trade => trade.status === 'closed');
  
  const totalUnrealizedPL = activeTrades.reduce((sum, trade) => {
    const metrics = getTradeMetrics(trade);
    return sum + (metrics.showPL ? metrics.pnl : 0);
  }, 0);
  
  const totalRealizedPL = closedTrades.reduce((sum, trade) => {
    return sum + (trade.profit_loss || 0);
  }, 0);

  const totalPL = totalUnrealizedPL + totalRealizedPL;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trades Report</CardTitle>
        <CardDescription>Complete trading history with side-aware P&L calculations</CardDescription>
        
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600">Total Trades</div>
            <div className="text-lg font-bold text-blue-800">{trades.length}</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-sm text-green-600">Active Positions</div>
            <div className="text-lg font-bold text-green-800">{activeTrades.length}</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="text-sm text-purple-600">Unrealized P&L</div>
            <div className={`text-lg font-bold ${totalUnrealizedPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalUnrealizedPL)}
            </div>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg">
            <div className="text-sm text-orange-600">Total P&L</div>
            <div className={`text-lg font-bold ${totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalPL)}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Entry Price</TableHead>
              <TableHead>Current Price</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unrealized P&L</TableHead>
              <TableHead>% Change</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => {
              const metrics = getTradeMetrics(trade);
              
              return (
                <TableRow key={trade.id}>
                  <TableCell className="font-medium">{trade.symbol}</TableCell>
                  <TableCell>
                    <Badge className={getSideColor(trade.side)}>
                      {trade.side.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{trade.order_type}</TableCell>
                  <TableCell>{formatCurrency(trade.price)}</TableCell>
                  <TableCell>{formatCurrency(metrics.currentPrice)}</TableCell>
                  <TableCell>{trade.quantity.toFixed(8)}</TableCell>
                  <TableCell>
                    {metrics.showPL ? (
                      <span className={`font-medium ${
                        metrics.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(metrics.pnl)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {metrics.showPL ? (
                      <span className={`font-medium ${
                        metrics.percentage >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {metrics.percentage > 0 ? '+' : ''}{metrics.percentage.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(trade.status)}>
                      {trade.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(trade.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
        {trades.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No trades found. Start trading to see your history here.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradesReport;
