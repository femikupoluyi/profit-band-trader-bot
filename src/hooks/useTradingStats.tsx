
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calculateSpotPL, shouldShowSpotPL } from '@/utils/formatters';

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
    closedPositionsProfit: 0,
    isActive: false,
    totalActive: 0,
    totalClosed: 0,
    totalProfitableClosed: 0,
    totalVolume: 0,
    profitPercentage: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const calculateActualPL = async (trade: any) => {
    try {
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());

      // For closed trades, use the stored profit_loss if it exists and is reasonable
      if (['closed', 'cancelled'].includes(trade.status)) {
        if (trade.profit_loss) {
          const storedPL = parseFloat(trade.profit_loss.toString());
          const volume = entryPrice * quantity;
          
          // Validate stored P&L is reasonable (not more than 50% of volume)
          if (Math.abs(storedPL) <= volume * 0.5) {
            return storedPL;
          }
          
          // If stored P&L is unrealistic, assume minimal loss for cancelled, zero for closed
          console.warn(`Unrealistic stored P&L for ${trade.symbol}: $${storedPL}, using fallback`);
          return trade.status === 'cancelled' ? -0.50 : 0;
        }
        return 0;
      }

      // For active trades, only calculate P&L if they meet spot criteria (filled buys)
      if (shouldShowSpotPL(trade)) {
        const { data: marketData } = await supabase
          .from('market_data')
          .select('price')
          .eq('symbol', trade.symbol)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (marketData) {
          const currentPrice = parseFloat(marketData.price.toString());
          
          // Use spot P&L calculation (only for filled buys)
          return calculateSpotPL(entryPrice, currentPrice, quantity);
        }
      }

      return 0;
    } catch (error) {
      console.error(`Error calculating P&L for trade ${trade.id}:`, error);
      return 0;
    }
  };

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
      
      console.log('Fetched trades in range:', trades.length);
      console.log('Fetched all active trades:', activeTrades.length);

      // Calculate actual P&L for all trades using spot logic
      const tradesWithActualPL = await Promise.all(
        trades.map(async (trade) => {
          const actualPL = await calculateActualPL(trade);
          return { ...trade, actualPL };
        })
      );

      // Calculate metrics with spot P&L logic
      const totalTrades = tradesWithActualPL.length;
      const closedTrades = tradesWithActualPL.filter(t => ['closed', 'cancelled'].includes(t.status));
      
      let totalProfit = 0;
      let closedPositionsProfit = 0;
      let totalVolume = 0;
      let profitableClosedCount = 0;

      tradesWithActualPL.forEach(trade => {
        const price = parseFloat(trade.price.toString());
        const quantity = parseFloat(trade.quantity.toString());
        const volume = price * quantity;
        const actualPL = trade.actualPL || 0;
        
        console.log(`Trade ${trade.symbol}: Side=${trade.side}, Entry=$${price.toFixed(2)}, Qty=${quantity.toFixed(6)}, Volume=$${volume.toFixed(2)}, Spot P&L=$${actualPL.toFixed(2)}, Status=${trade.status}`);
        
        totalProfit += actualPL;
        totalVolume += volume;
        
        // Add to closed positions profit only if trade is closed
        if (['closed', 'cancelled'].includes(trade.status)) {
          closedPositionsProfit += actualPL;
          
          // Count closed and cancelled trades with positive actual P&L as profitable
          if (actualPL > 0) {
            profitableClosedCount++;
          }
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
        closedPositionsProfit: Math.round(closedPositionsProfit * 100) / 100,
        isActive: config?.is_active || false,
        totalActive: totalActiveCount,
        totalClosed: closedTrades.length,
        totalProfitableClosed: profitableClosedCount,
        totalVolume: Math.round(totalVolume * 100) / 100,
        profitPercentage: Math.round(profitPercentage * 100) / 100
      };

      console.log('Calculated stats with spot P&L logic:', newStats);
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
