
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

      // Get trades within time range
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

      const trades = tradesInRange || [];
      console.log('Fetched trades:', trades.length, trades);

      // Calculate metrics with proper validation
      const totalTrades = trades.length;
      const activeTrades = trades.filter(t => ['pending', 'filled'].includes(t.status));
      // Include both 'closed' and 'cancelled' as closed trades since manual close sets status to 'cancelled'
      const closedTrades = trades.filter(t => ['closed', 'cancelled'].includes(t.status));
      
      let totalProfit = 0;
      let totalVolume = 0;
      let profitableClosedCount = 0;

      trades.forEach(trade => {
        // Ensure proper number conversion and validation
        const profitLoss = trade.profit_loss ? parseFloat(trade.profit_loss.toString()) : 0;
        const price = trade.price ? parseFloat(trade.price.toString()) : 0;
        const quantity = trade.quantity ? parseFloat(trade.quantity.toString()) : 0;
        const volume = price * quantity;
        
        console.log(`Trade ${trade.symbol}: P&L=${profitLoss}, Volume=${volume}, Status=${trade.status}`);
        
        totalProfit += profitLoss;
        totalVolume += volume;
        
        // Count both closed and cancelled trades as profitable if they have positive P&L
        if (['closed', 'cancelled'].includes(trade.status) && profitLoss > 0) {
          profitableClosedCount++;
        }
      });

      // Calculate profit percentage based on closed trades only
      const profitPercentage = closedTrades.length > 0 ? (profitableClosedCount / closedTrades.length) * 100 : 0;

      // Get unique active trading pairs
      const activePairs = new Set(activeTrades.map(trade => trade.symbol)).size;

      const newStats = {
        totalTrades,
        activePairs,
        totalProfit: Math.round(totalProfit * 100) / 100, // Round to 2 decimal places
        isActive: config?.is_active || false,
        totalActive: activeTrades.length,
        totalClosed: closedTrades.length,
        totalProfitableClosed: profitableClosedCount,
        totalVolume: Math.round(totalVolume * 100) / 100, // Round to 2 decimal places
        profitPercentage: Math.round(profitPercentage * 100) / 100 // Round to 2 decimal places
      };

      console.log('Calculated stats:', newStats);
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
