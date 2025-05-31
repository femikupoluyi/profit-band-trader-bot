import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Download, Filter } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';

interface Trade {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  status: string;
  order_type: string;
  profit_loss?: number;
  created_at: string;
  updated_at: string;
  bybit_order_id?: string;
}

interface TimeRange {
  from: Date;
  to: Date;
}

const TradesReport = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    return { from: sevenDaysAgo, to: now };
  });
  const [quickSelect, setQuickSelect] = useState<string>('7d');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (user) {
      fetchTrades();
    }
  }, [user, timeRange, statusFilter]);

  const handleQuickSelect = (period: string) => {
    setQuickSelect(period);
    const now = new Date();
    let from: Date;

    switch (period) {
      case '1d':
        from = subDays(now, 1);
        break;
      case '7d':
        from = subDays(now, 7);
        break;
      case '30d':
        from = subDays(now, 30);
        break;
      case '90d':
        from = subDays(now, 90);
        break;
      case '1y':
        from = subDays(now, 365);
        break;
      default:
        from = subDays(now, 7);
    }

    setTimeRange({ from, to: now });
  };

  const fetchTrades = async () => {
    if (!user) return;

    setLoading(true);
    try {
      console.log('Fetching trades for time range:', timeRange);

      let query = supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startOfDay(timeRange.from).toISOString())
        .lte('created_at', endOfDay(timeRange.to).toISOString())
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log('Fetched trades:', data?.length || 0, 'trades');
      
      // Convert the data to match our Trade interface with proper P&L calculation
      const formattedTrades: Trade[] = (data || []).map(trade => {
        const quantity = typeof trade.quantity === 'string' ? parseFloat(trade.quantity) : trade.quantity;
        const price = typeof trade.price === 'string' ? parseFloat(trade.price) : trade.price;
        
        // Use stored profit_loss value if available, otherwise calculate as 0 for active trades
        let profitLoss = 0;
        if (trade.profit_loss) {
          profitLoss = typeof trade.profit_loss === 'string' ? parseFloat(trade.profit_loss) : trade.profit_loss;
        }
        
        console.log(`Processing trade ${trade.symbol}: Price=$${price}, Qty=${quantity}, P&L=$${profitLoss}, Status=${trade.status}`);
        
        return {
          ...trade,
          quantity,
          price,
          profit_loss: profitLoss
        };
      });
      
      setTrades(formattedTrades);
    } catch (error) {
      console.error('Error fetching trades:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (trades.length === 0) return;

    const headers = [
      'Date',
      'Symbol',
      'Side',
      'Type',
      'Quantity',
      'Price',
      'Volume',
      'P&L',
      'Status',
      'Bybit Order ID'
    ];

    const csvData = trades.map(trade => {
      const quantity = trade.quantity;
      const price = trade.price;
      const volume = quantity * price;
      const profitLoss = trade.profit_loss || 0;

      return [
        format(new Date(trade.created_at), 'yyyy-MM-dd HH:mm:ss'),
        trade.symbol,
        trade.side.toUpperCase(),
        trade.order_type,
        quantity.toFixed(6),
        `$${price.toFixed(2)}`,
        `$${volume.toFixed(2)}`,
        profitLoss !== 0 ? `$${profitLoss.toFixed(2)}` : '-',
        trade.status,
        trade.bybit_order_id || '-'
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `trades_report_${format(timeRange.from, 'yyyy-MM-dd')}_to_${format(timeRange.to, 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      filled: "default",
      pending: "secondary",
      cancelled: "outline",
      partial_filled: "secondary",
    };
    return <Badge variant={variants[status] || "outline"}>{status.replace('_', ' ')}</Badge>;
  };

  const getSideBadge = (side: string) => {
    return (
      <Badge variant={side === 'buy' ? "default" : "destructive"}>
        {side.toUpperCase()}
      </Badge>
    );
  };

  // Calculate summary statistics with corrected P&L
  const totalTrades = trades.length;
  const totalVolume = trades.reduce((sum, trade) => {
    const price = trade.price;
    const quantity = trade.quantity;
    return sum + (price * quantity);
  }, 0);
  const totalPL = trades.reduce((sum, trade) => {
    return sum + (trade.profit_loss || 0);
  }, 0);
  const activeTrades = trades.filter(t => ['pending', 'partial_filled', 'filled'].includes(t.status)).length;
  const closedTrades = trades.filter(t => ['closed', 'cancelled'].includes(t.status)).length;

  console.log('Summary calculations:', {
    totalTrades,
    totalVolume: totalVolume.toFixed(2),
    totalPL: totalPL.toFixed(2),
    activeTrades,
    closedTrades
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Trades Report</span>
          <Button 
            onClick={downloadCSV} 
            disabled={trades.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
        </CardTitle>
        <CardDescription>
          Generate detailed reports of your trading activity within selected time frames.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Quick Time Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quick Select</label>
            <Select value={quickSelect} onValueChange={handleQuickSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* From Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">From Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !timeRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {timeRange.from ? format(timeRange.from, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={timeRange.from}
                  onSelect={(date) => date && setTimeRange(prev => ({ ...prev, from: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* To Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">To Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !timeRange.to && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {timeRange.to ? format(timeRange.to, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={timeRange.to}
                  onSelect={(date) => date && setTimeRange(prev => ({ ...prev, to: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status Filter</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="filled">Filled</SelectItem>
                <SelectItem value="partial_filled">Partial Filled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Total Trades</div>
            <div className="text-2xl font-bold">{totalTrades}</div>
          </div>
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Active</div>
            <div className="text-2xl font-bold text-blue-600">{activeTrades}</div>
          </div>
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Closed</div>
            <div className="text-2xl font-bold text-gray-600">{closedTrades}</div>
          </div>
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Total Volume</div>
            <div className="text-2xl font-bold">{formatCurrency(totalVolume)}</div>
          </div>
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Total P&L</div>
            <div className={`text-2xl font-bold ${totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalPL)}
            </div>
          </div>
        </div>

        {/* Trades Table */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No trades found for the selected time range and filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>P&L</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => {
                  const quantity = trade.quantity;
                  const price = trade.price;
                  const volume = quantity * price;
                  const profitLoss = trade.profit_loss || 0;

                  return (
                    <TableRow key={trade.id}>
                      <TableCell>
                        {format(new Date(trade.created_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="font-medium">{trade.symbol}</TableCell>
                      <TableCell>{getSideBadge(trade.side)}</TableCell>
                      <TableCell className="capitalize">{trade.order_type}</TableCell>
                      <TableCell>{quantity.toFixed(6)}</TableCell>
                      <TableCell>${price.toFixed(2)}</TableCell>
                      <TableCell>{formatCurrency(volume)}</TableCell>
                      <TableCell>
                        {profitLoss !== 0 ? (
                          <span className={profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(profitLoss)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(trade.status)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradesReport;
