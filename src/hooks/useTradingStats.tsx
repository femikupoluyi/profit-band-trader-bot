
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TradingStats {
  totalTrades: number;
  activePairs: number;
  totalProfit: number;
  isActive: boolean;
}

export const useTradingStats = (userId?: string) => {
  const { toast } = useToast();
  const [stats, setStats] = useState<TradingStats>({
    totalTrades: 0,
    activePairs: 0,
    totalProfit: 0,
    isActive: false
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchTradingStats = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      console.log('Fetching trading stats for user:', userId);

      // Get trading config with proper error handling
      const { data: config, error: configError } = await supabase
        .from('trading_configs')
        .select('is_active')
        .eq('user_id', userId)
        .maybeSingle();

      if (configError) {
        console.error('Error fetching config:', configError);
      }

      // Get total trades count
      const { count: totalTrades, error: tradesCountError } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (tradesCountError) {
        console.error('Error fetching trades count:', tradesCountError);
      }

      // Get completed trades for profit calculation
      const { data: completedTrades, error: profitError } = await supabase
        .from('trades')
        .select('profit_loss, price, quantity, side')
        .eq('user_id', userId)
        .in('status', ['filled', 'closed']);

      if (profitError) {
        console.error('Error fetching profit data:', profitError);
      }

      // Calculate total profit/loss more accurately
      let totalProfit = 0;
      if (completedTrades && completedTrades.length > 0) {
        totalProfit = completedTrades.reduce((sum, trade) => {
          const profitLoss = parseFloat(trade.profit_loss?.toString() || '0');
          return sum + profitLoss;
        }, 0);
      }

      // Get active trading pairs (unique symbols with open positions)
      const { data: activeTrades, error: activeError } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', userId)
        .in('status', ['pending', 'filled'])
        .eq('side', 'buy'); // Only count buy positions as active pairs

      if (activeError) {
        console.error('Error fetching active trades:', activeError);
      }

      const activePairs = activeTrades ? new Set(activeTrades.map(trade => trade.symbol)).size : 0;

      const newStats = {
        totalTrades: totalTrades || 0,
        activePairs,
        totalProfit,
        isActive: config?.is_active || false
      };

      console.log('Updated stats:', newStats);
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
  }, [userId]);

  return {
    stats,
    isLoading,
    refetch: fetchTradingStats
  };
};
