import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { calculateActualPL, calculateTradeMetrics } from '@/utils/plCalculations';
import TradesReportFilters from './TradesReportFilters';
import TradesReportSummary from './TradesReportSummary';
import TradesReportTable from './TradesReportTable';
import BybitSyncButton from './BybitSyncButton';

interface Trade {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  status: string;
  order_type: string;
  profit_loss?: number;
  actualPL?: number;
  buy_fill_price?: number;
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

  // Only fetch when user, timeRange, or statusFilter changes - no auto-refresh
  useEffect(() => {
    if (user) {
      fetchTrades();
    }
  }, [user, timeRange, statusFilter]);

  const fetchTrades = async () => {
    if (!user) return;

    setLoading(true);
    try {
      console.log('📊 Fetching trades for time range:', timeRange);

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

      if (error) {
        console.error('❌ Error fetching trades:', error);
        throw error;
      }

      console.log('✅ Fetched trades:', data?.length || 0, 'trades');
      
      // Calculate actual P&L for each trade
      const tradesWithActualPL = await Promise.all(
        (data || []).map(async (trade) => {
          try {
            const quantity = typeof trade.quantity === 'string' ? parseFloat(trade.quantity) : trade.quantity;
            const price = typeof trade.price === 'string' ? parseFloat(trade.price) : trade.price;
            const fillPrice = trade.buy_fill_price ? parseFloat(trade.buy_fill_price.toString()) : null;
            
            const actualPL = await calculateActualPL(trade, user.id);
            
            console.log(`📈 Processing trade ${trade.symbol}: Side=${trade.side}, Status=${trade.status}, Price=$${price}, Fill=${fillPrice ? `$${fillPrice}` : 'N/A'}, Qty=${quantity}, Actual P&L=$${actualPL.toFixed(2)}`);
            
            return {
              ...trade,
              quantity,
              price,
              buy_fill_price: fillPrice,
              actualPL
            };
          } catch (error) {
            console.error(`❌ Error processing trade ${trade.id}:`, error);
            return {
              ...trade,
              quantity: typeof trade.quantity === 'string' ? parseFloat(trade.quantity) : trade.quantity,
              price: typeof trade.price === 'string' ? parseFloat(trade.price) : trade.price,
              buy_fill_price: trade.buy_fill_price ? parseFloat(trade.buy_fill_price.toString()) : null,
              actualPL: 0
            };
          }
        })
      );
      
      setTrades(tradesWithActualPL);
    } catch (error) {
      console.error('❌ Error fetching trades:', error);
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
      'Order Price',
      'Fill Price',
      'Volume',
      'Actual P&L',
      'Status',
      'Bybit Order ID'
    ];

    const csvData = trades.map(trade => {
      const quantity = trade.quantity;
      const price = trade.price;
      const fillPrice = trade.buy_fill_price;
      const effectivePrice = fillPrice || price;
      const volume = quantity * effectivePrice;
      const actualPL = trade.actualPL || 0;

      return [
        format(new Date(trade.created_at), 'yyyy-MM-dd HH:mm:ss'),
        trade.symbol,
        trade.side.toUpperCase(),
        trade.order_type,
        quantity.toFixed(6),
        `$${price.toFixed(2)}`,
        fillPrice ? `$${fillPrice.toFixed(2)}` : 'N/A',
        `$${volume.toFixed(2)}`,
        actualPL !== 0 ? `$${actualPL.toFixed(2)}` : '-',
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

  const metrics = calculateTradeMetrics(trades);
  const activeTrades = trades.filter(t => ['pending', 'partial_filled', 'filled'].includes(t.status)).length;

  console.log('📊 Summary calculations with corrected P&L:', {
    ...metrics,
    activeTrades
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Trades Report</span>
          <div className="flex items-center gap-2">
            <BybitSyncButton onSyncComplete={fetchTrades} />
            <Button 
              onClick={downloadCSV} 
              disabled={trades.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Generate detailed reports of your trading activity. Use "Sync from Bybit" to import your latest trades. P&L calculations use stored values for closed trades and live market prices for active trades.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <TradesReportFilters
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          quickSelect={quickSelect}
          setQuickSelect={setQuickSelect}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />

        <TradesReportSummary
          totalTrades={metrics.totalTrades}
          activeTrades={activeTrades}
          closedTrades={metrics.closedTrades}
          totalVolume={metrics.totalVolume}
          totalPL={metrics.totalProfit}
          closedPositionsProfit={metrics.closedPositionsProfit}
        />

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No trades found for the selected time range and filters. Click "Sync from Bybit" to import your trades.
          </div>
        ) : (
          <TradesReportTable trades={trades} />
        )}
      </CardContent>
    </Card>
  );
};

export default TradesReport;
