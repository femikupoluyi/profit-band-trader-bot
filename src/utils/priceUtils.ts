
import { supabase } from '@/integrations/supabase/client';
import { CredentialsManager } from '@/services/trading/credentialsManager';

export const getCurrentPrice = async (symbol: string, userId?: string) => {
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

    // If no market data and userId provided, try to get live price from Bybit
    if (userId) {
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
    }

    return null;
  } catch (error) {
    console.error(`Error getting current price for ${symbol}:`, error);
    return null;
  }
};
