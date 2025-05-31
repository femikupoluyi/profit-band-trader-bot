
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TradingStats {
  totalTrades: number;
  activePairs: number;
  totalProfit: number;
  isActive: boolean;
  totalActive: number;
  totalClosed: number;
  totalProfitableClosed: number;
  totalVolume: number;
  profitPercentage: number;
}

interface TimeRange {
  from: Date;
  to: Date;
}

export const useTradingStats = (userId?: string) => {
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    return { from: sevenDaysAgo, to: now };
  });

  const [stats, setStats] = useState<TradingStats>({
    totalTrades: 0,
    activePairs: 0,
    totalProfit: 0,
    isActive: false,
    totalActive: 0,
    totalClosed: 0,
    totalProfitableClosed: 0,
    totalVolume: 0,
    profitPercentage: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchTradingStats = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      console.log('Fetching trading stats for user:', userId, 'Time range:', timeRange);

      // Get trading config
      const { data: config, error: configError } = await supabase
        .from('trading_configs')
        .select('is_active')
        .eq('user_id', userId)
        .maybeSingle();

      if (configError) {
        console.error('Error fetching config:', configError);
      }

      // Get trades within time range for time-based metrics
      const { data: tradesInRange, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', timeRange.from.toISOString())
        .lte('created_at', timeRange.to.toISOString());

      if (tradesError) {
        console.error('Error fetching trades:', tradesError);
        return;
      }

      // Get ALL active trades (not limited by time range) for active pairs and total active count
      const { data: allActiveTrades, error: activeTradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'partial_filled', 'filled']);

      if (activeTradesError) {
        console.error('Error fetching active trades:', activeTradesError);
        return;
      }

      const trades = tradesInRange || [];
      const activeTrades = allActiveTrades || [];
      
      console.log('Fetched trades in range:', trades.length, trades);
      console.log('Fetched all active trades:', activeTrades.length, activeTrades);

      // Calculate metrics with proper validation
      const totalTrades = trades.length;
      const activeTradesInRange = trades.filter(t => ['pending', 'partial_filled', 'filled'].includes(t.status));
      const closedTrades = trades.filter(t => ['closed', 'cancelled'].includes(t.status));
      
      let totalProfit = 0;
      let totalVolume = 0;
      let profitableClosedCount = 0;

      trades.forEach(trade => {
        const price = trade.price ? parseFloat(trade.price.toString()) : 0;
        const quantity = trade.quantity ? parseFloat(trade.quantity.toString()) : 0;
        const volume = price * quantity;
        
        // Only count profit/loss for closed trades, and ensure it's a reasonable value
        let profitLoss = 0;
        if (['closed', 'cancelled'].includes(trade.status) && trade.profit_loss) {
          const rawPL = parseFloat(trade.profit_loss.toString());
          
          // Validate P&L is reasonable (should not exceed the original investment by more than 100%)
          if (Math.abs(rawPL) <= volume * 2) {
            profitLoss = rawPL;
          } else {
            console.warn(`Unrealistic P&L detected for trade ${trade.symbol}: $${rawPL}, volume: $${volume}`);
            // For cancelled trades with unrealistic P&L, assume small loss
            profitLoss = ['cancelled'].includes(trade.status) ? -1 : 0;
          }
        }
        
        console.log(`Trade ${trade.symbol}: Entry=$${price}, Qty=${quantity}, Volume=$${volume.toFixed(2)}, P&L=$${profitLoss.toFixed(2)}, Status=${trade.status}`);
        
        totalProfit += profitLoss;
        totalVolume += volume;
        
        // Count closed and cancelled trades with positive P&L as profitable
        if (['closed', 'cancelled'].includes(trade.status) && profitLoss > 0) {
          profitableClosedCount++;
        }
      });

      // Calculate profit percentage based on closed trades only
      const profitPercentage = closedTrades.length > 0 ? (profitableClosedCount / closedTrades.length) * 100 : 0;

      // Get unique active trading pairs from ALL active trades
      const activePairs = new Set(activeTrades.map(trade => trade.symbol)).size;
      const totalActiveCount = activeTrades.length;

      const newStats = {
        totalTrades,
        activePairs,
        totalProfit: Math.round(totalProfit * 100) / 100,
        isActive: config?.is_active || false,
        totalActive: totalActiveCount,
        totalClosed: closedTrades.length,
        totalProfitableClosed: profitableClosedCount,
        totalVolume: Math.round(totalVolume * 100) / 100,
        profitPercentage: Math.round(profitPercentage * 100) / 100
      };

      console.log('Calculated stats with P&L validation:', newStats);
      setStats(newStats);
    } catch (error) {
      console.error('Error fetching trading stats:', error);
      toast({
        title: "Error",
        description: "Failed to fetch trading statistics.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchTradingStats();
    }
  }, [userId, timeRange]);

  return {
    stats,
    isLoading,
    timeRange,
    setTimeRange,
    refetch: fetchTradingStats
  };
};
