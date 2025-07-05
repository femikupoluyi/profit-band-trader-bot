
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calculateActualPL, calculateTradeMetrics } from '@/utils/plCalculations';

interface TradingStats {
  totalTrades: number;
  activePairs: number;
  totalProfit: number;
  closedPositionsProfit: number;
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

export const useTradingStatsData = (userId?: string, timeRange?: TimeRange) => {
  const { toast } = useToast();
  const [stats, setStats] = useState<TradingStats>({
    totalTrades: 0,
    activePairs: 0,
    totalProfit: 0,
    closedPositionsProfit: 0,
    isActive: false,
    totalActive: 0,
    totalClosed: 0,
    totalProfitableClosed: 0,
    totalVolume: 0,
    profitPercentage: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchTradingStats = async () => {
    if (!userId || !timeRange) return;

    setIsLoading(true);
    try {
      console.log('📊 Fetching trading stats for user:', userId, 'Time range:', timeRange);

      // Get trading config
      const { data: config, error: configError } = await supabase
        .from('trading_configs')
        .select('is_active')
        .eq('user_id', userId)
        .maybeSingle();

      if (configError) {
        console.error('❌ Error fetching config:', configError);
      }

      // Get trades within time range for time-based metrics
      const { data: tradesInRange, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', timeRange.from.toISOString())
        .lte('created_at', timeRange.to.toISOString());

      if (tradesError) {
        console.error('❌ Error fetching trades:', tradesError);
        return;
      }

      // Get ALL active trades (not limited by time range) for active pairs and total active count
      const { data: allActiveTrades, error: activeTradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'partial_filled', 'filled']);

      if (activeTradesError) {
        console.error('❌ Error fetching active trades:', activeTradesError);
        return;
      }

      const trades = tradesInRange || [];
      const activeTrades = allActiveTrades || [];
      
      console.log('✅ Fetched trades in range:', trades.length);
      console.log('✅ Fetched all active trades:', activeTrades.length);

      // Calculate actual P&L for all trades
      const tradesWithActualPL = await Promise.all(
        trades.map(async (trade) => {
          try {
            const actualPL = await calculateActualPL(trade, userId);
            return { ...trade, actualPL };
          } catch (error) {
            console.error(`❌ Error calculating P&L for trade ${trade.id}:`, error);
            return { ...trade, actualPL: 0 };
          }
        })
      );

      // Calculate metrics with actual P&L
      const metrics = calculateTradeMetrics(tradesWithActualPL);

      // Get unique active trading pairs from ALL active trades (only filled ones for accurate pair count)
      const activeFilledTrades = activeTrades.filter(trade => trade.status === 'filled');
      const activePairs = new Set(activeFilledTrades.map(trade => trade.symbol)).size;
      const totalActiveCount = activeTrades.length;

      const newStats = {
        ...metrics,
        activePairs,
        isActive: config?.is_active || false,
        totalActive: totalActiveCount,
        totalClosed: metrics.closedTrades,
        totalProfitableClosed: metrics.profitableClosedCount,
      };

      console.log('✅ Calculated stats with corrected P&L logic:', newStats);
      console.log('🔍 Debug - activePairs:', activePairs, 'totalActiveCount:', totalActiveCount);
      console.log('🔍 Debug - activeFilledTrades:', activeFilledTrades.length, 'allActiveTrades:', activeTrades.length);
      setStats(newStats);
    } catch (error) {
      console.error('❌ Error fetching trading stats:', error);
      toast({
        title: "Error",
        description: "Failed to fetch trading statistics.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Only fetch when userId or timeRange changes - no auto-refresh
  useEffect(() => {
    if (userId && timeRange) {
      fetchTradingStats();
    }
  }, [userId, timeRange]);

  return {
    stats,
    isLoading,
    refetch: fetchTradingStats
  };
};
