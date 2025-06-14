
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { PriceFormatter } from './core/PriceFormatter';

export async function closePosition(userId: string, tradeId: string, reason?: string): Promise<boolean> {
  try {
    console.log(`🔄 Attempting to close position for trade ${tradeId}`);

    // Fetch user's Bybit credentials from api_credentials table
    const { data: credentials, error: credentialsError } = await supabase
      .from('api_credentials')
      .select('api_key, api_secret')
      .eq('user_id', userId)
      .eq('exchange_name', 'bybit')
      .single();

    if (credentialsError || !credentials) {
      console.error('❌ Could not fetch Bybit credentials:', credentialsError);
      return false;
    }

    // Initialize Bybit service with credentials
    const bybitService = new BybitService(credentials.api_key, credentials.api_secret, true);

    // Fetch the trade
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      console.error(`❌ Trade not found: ${tradeId}`, tradeError);
      return false;
    }

    // Check if the trade is already closed
    if (trade.status === 'closed') {
      console.warn(`⚠️ Trade ${tradeId} is already closed`);
      return true;
    }

    // Get formatted quantity with proper async handling
    const formattedQuantity = await PriceFormatter.formatQuantityForSymbol(trade.symbol, parseFloat(trade.quantity.toString()));
    
    console.log(`📤 Placing market sell order for ${trade.symbol}:`, {
      quantity: formattedQuantity,
      symbol: trade.symbol,
      tradeId: tradeId
    });

    // Place market sell order using the correct BybitService method
    const sellOrderResult = await bybitService.placeOrder({
      category: 'spot',
      symbol: trade.symbol,
      side: 'Sell',
      orderType: 'Market',
      qty: formattedQuantity.toString()
    });

    if (!sellOrderResult || sellOrderResult.retCode !== 0) {
      console.error(`❌ Failed to place sell order for trade ${tradeId}:`, sellOrderResult);
      return false;
    }

    // Update trade status to closed
    const { error: updateError } = await supabase
      .from('trades')
      .update({ status: 'closed' })
      .eq('id', tradeId);

    if (updateError) {
      console.error(`❌ Error updating trade status:`, updateError);
      return false;
    }

    console.log(`✅ Successfully closed position for trade ${tradeId}`);
    return true;

  } catch (error) {
    console.error(`❌ Error closing position for trade ${tradeId}:`, error);
    return false;
  }
}

export class TradeCloser {
  private userId: string;
  private bybitService: BybitService;
  private config: any;

  constructor(userId: string, bybitService: BybitService, config: any) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.config = config;
  }

  async closePosition(trade: any, currentPrice: number, profitLoss: number): Promise<void> {
    try {
      const success = await closePosition(this.userId, trade.id, 'Take Profit Reached');
      if (success) {
        console.log(`✅ Successfully closed position for ${trade.symbol}`);
      } else {
        console.error(`❌ Failed to close position for ${trade.symbol}`);
      }
    } catch (error) {
      console.error(`❌ Error closing position for ${trade.symbol}:`, error);
    }
  }
}
