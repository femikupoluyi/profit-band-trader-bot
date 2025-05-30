
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Trade {
  id: string;
  symbol: string;
  side: string;
  quantity: string;
  price: string;
  status: string;
  order_type: string;
  profit_loss?: string;
  created_at: string;
}

const TradeHistory = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTrades();
    }
  }, [user]);

  const fetchTrades = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setTrades(data || []);
    } catch (error) {
      console.error('Error fetching trades:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      filled: "default",
      pending: "secondary",
      cancelled: "outline",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getSideBadge = (side: string) => {
    return (
      <Badge variant={side === 'buy' ? "default" : "destructive"}>
        {side.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>Loading your trading history...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade History</CardTitle>
        <CardDescription>
          View your recent trading activity and performance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {trades.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No trades found. Your trading history will appear here once you start trading.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>P&L</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell className="font-medium">{trade.symbol}</TableCell>
                    <TableCell>{getSideBadge(trade.side)}</TableCell>
                    <TableCell className="capitalize">{trade.order_type}</TableCell>
                    <TableCell>{parseFloat(trade.quantity).toFixed(6)}</TableCell>
                    <TableCell>${parseFloat(trade.price).toFixed(2)}</TableCell>
                    <TableCell>
                      {trade.profit_loss ? (
                        <span className={parseFloat(trade.profit_loss) >= 0 ? 'text-green-600' : 'text-red-600'}>
                          ${parseFloat(trade.profit_loss).toFixed(2)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(trade.status)}</TableCell>
                    <TableCell>
                      {format(new Date(trade.created_at), 'MMM dd, yyyy HH:mm')}
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

export default TradeHistory;
