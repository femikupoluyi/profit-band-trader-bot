
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ActiveTrade } from '@/types/trading';
import { calculateSideAwarePL } from '@/utils/formatters';
import { getCurrentPrice } from '@/utils/priceUtils';

export const useActiveTrades = (enableAutoRefresh: boolean = false) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const calculateActualPL = async (trade: any) => {
    try {
      // Only calculate P&L for filled orders
      if (trade.status !== 'filled') {
        return {
          currentPrice: parseFloat(trade.price.toString()),
          unrealizedPL: 0
        };
      }

      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());
      const fillPrice = trade.buy_fill_price ? parseFloat(trade.buy_fill_price.toString()) : null;

      // Get current market price for P&L calculation
      const currentPrice = await getCurrentPrice(trade.symbol, user?.id);

      if (currentPrice) {
        // Calculate actual P&L using current market price with side-aware calculation
        const unrealizedPL = calculateSideAwarePL(
          trade.side,
          entryPrice,
          currentPrice,
          quantity,
          fillPrice,
          trade.status
        );
        
        return {
          currentPrice,
          unrealizedPL
        };
      }

      return {
        currentPrice: entryPrice,
        unrealizedPL: 0
      };
    } catch (error) {
      console.error(`❌ Error calculating actual P&L for trade ${trade.id}:`, error);
      return {
        currentPrice: parseFloat(trade.price.toString()),
        unrealizedPL: 0
      };
    }
  };

  const fetchActiveTrades = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      console.log('📊 Fetching active trades for user:', user.id);

      // First get current trading configuration to filter valid symbols
      const { data: config } = await supabase
        .from('trading_configs')
        .select('trading_pairs')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      const validSymbols = config?.trading_pairs || [];
      console.log('✅ Valid trading pairs from config:', validSymbols);

      // Only fetch trades for currently configured symbols, exclude sell orders (they should be closed)
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'filled'])
        .eq('side', 'buy') // CRITICAL: Only show buy orders as active
        .in('symbol', validSymbols) // CRITICAL: Only show currently configured symbols
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching active trades:', error);
        toast({
          title: "Error",
          description: "Failed to fetch active trades.",
          variant: "destructive",
        });
        return;
      }

      const tradesWithActualPL = await Promise.all(
        (trades || []).map(async (trade) => {
          try {
            const entryPrice = parseFloat(trade.price.toString());
            const quantity = parseFloat(trade.quantity.toString());
            const volume = entryPrice * quantity;
            const fillPrice = trade.buy_fill_price ? parseFloat(trade.buy_fill_price.toString()) : null;

            const { currentPrice, unrealizedPL } = await calculateActualPL(trade);
            
            console.log(`📈 Trade ${trade.symbol}: Status=${trade.status}, Entry=$${entryPrice}, Fill=$${fillPrice || 'N/A'}, Current=$${currentPrice}, Qty=${quantity}, Unrealized P&L=$${unrealizedPL.toFixed(2)}`);

            return {
              ...trade,
              price: entryPrice,
              quantity,
              profit_loss: 0, // Active trades don't have realized P&L
              currentPrice,
              unrealizedPL,
              volume,
              fillPrice, // Add fill price for display
            };
          } catch (error) {
            console.error(`❌ Error processing trade ${trade.id}:`, error);
            const entryPrice = parseFloat(trade.price.toString());
            const quantity = parseFloat(trade.quantity.toString());
            return {
              ...trade,
              price: entryPrice,
              quantity,
              profit_loss: 0,
              currentPrice: entryPrice,
              unrealizedPL: 0,
              volume: entryPrice * quantity,
              fillPrice: trade.buy_fill_price ? parseFloat(trade.buy_fill_price.toString()) : null,
            };
          }
        })
      );

      console.log('✅ Active trades with corrected P&L:', tradesWithActualPL);
      setActiveTrades(tradesWithActualPL);
    } catch (error) {
      console.error('❌ Error fetching active trades:', error);
      toast({
        title: "Error",
        description: "Failed to fetch active trades.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchActiveTrades();
      
      // Only set up auto-refresh if explicitly enabled
      if (enableAutoRefresh) {
        console.log('🔄 Setting up auto-refresh for active trades (30s interval)');
        const interval = setInterval(fetchActiveTrades, 30000);
        return () => {
          console.log('🛑 Clearing auto-refresh for active trades');
          clearInterval(interval);
        };
      }
    }
  }, [user?.id, enableAutoRefresh]);

  return {
    activeTrades,
    isLoading,
    refetch: fetchActiveTrades
  };
};
