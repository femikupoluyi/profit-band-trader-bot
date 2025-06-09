
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calculateSideAwarePL } from '@/utils/formatters';
import { CredentialsManager } from '@/services/trading/credentialsManager';

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

  const getCurrentPrice = async (symbol: string, userId: string) => {
    try {
      // First try to get from market_data table
      const { data: marketData } = await supabase
        .from('market_data')
        .select('price')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (marketData && marketData.price) {
        return parseFloat(marketData.price.toString());
      }

      // If no market data, try to get live price from Bybit
      try {
        const credentialsManager = new CredentialsManager(userId);
        const bybitService = await credentialsManager.fetchCredentials();
        
        if (bybitService) {
          const priceData = await bybitService.getMarketPrice(symbol);
          if (priceData && priceData.price) {
            return priceData.price;
          }
        }
      } catch (error) {
        console.warn(`Could not fetch live price for ${symbol}:`, error);
      }

      return null;
    } catch (error) {
      console.error(`Error getting current price for ${symbol}:`, error);
      return null;
    }
  };

  const calculateActualPL = async (trade: any, userId: string) => {
    try {
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());
      const fillPrice = trade.buy_fill_price ? parseFloat(trade.buy_fill_price.toString()) : null;

      // For closed trades, use the stored profit_loss if it exists and is reasonable
      if (['closed', 'cancelled'].includes(trade.status)) {
        if (trade.profit_loss !== null && trade.profit_loss !== undefined) {
          const storedPL = parseFloat(trade.profit_loss.toString());
          console.log(`Using stored P&L for closed trade ${trade.symbol}: $${storedPL}`);
          return storedPL;
        }
        return 0;
      }

      // For active filled trades, calculate real-time P&L
      if (trade.status === 'filled') {
        const currentPrice = await getCurrentPrice(trade.symbol, userId);
        
        if (currentPrice) {
          const actualPL = calculateSideAwarePL(
            trade.side, 
            entryPrice, 
            currentPrice, 
            quantity,
            fillPrice,
            trade.status
          );
          
          console.log(`Calculated P&L for ${trade.symbol}: Entry=$${entryPrice}, Current=$${currentPrice}, P&L=$${actualPL}`);
          return actualPL;
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

      // Calculate actual P&L for all trades
      const tradesWithActualPL = await Promise.all(
        trades.map(async (trade) => {
          const actualPL = await calculateActualPL(trade, userId);
          return { ...trade, actualPL };
        })
      );

      // Calculate metrics with actual P&L
      const totalTrades = tradesWithActualPL.length;
      const closedTrades = tradesWithActualPL.filter(t => ['closed', 'cancelled'].includes(t.status));
      const filledTrades = tradesWithActualPL.filter(t => t.status === 'filled');
      
      let totalProfit = 0;
      let closedPositionsProfit = 0;
      let totalVolume = 0;
      let profitableClosedCount = 0;

      tradesWithActualPL.forEach(trade => {
        const price = parseFloat(trade.price.toString());
        const quantity = parseFloat(trade.quantity.toString());
        const fillPrice = trade.buy_fill_price ? parseFloat(trade.buy_fill_price.toString()) : null;
        const effectivePrice = fillPrice || price;
        const volume = effectivePrice * quantity;
        const actualPL = trade.actualPL || 0;
        
        console.log(`Trade ${trade.symbol}: Side=${trade.side}, Status=${trade.status}, Entry=$${price.toFixed(2)}, Fill=${fillPrice ? `$${fillPrice.toFixed(2)}` : 'N/A'}, Qty=${quantity.toFixed(6)}, Volume=$${volume.toFixed(2)}, Actual P&L=$${actualPL.toFixed(2)}`);
        
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

      // Get unique active trading pairs from ALL active trades (only filled ones for accurate pair count)
      const activeFilledTrades = activeTrades.filter(trade => trade.status === 'filled');
      const activePairs = new Set(activeFilledTrades.map(trade => trade.symbol)).size;
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

      console.log('Calculated stats with corrected P&L logic:', newStats);
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
