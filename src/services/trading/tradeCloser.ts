import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { PriceFormatter } from './core/PriceFormatter';

export async function closePosition(userId: string, tradeId: string, reason?: string): Promise<boolean> {
  try {
    console.log(`🔄 Attempting to close position for trade ${tradeId}`);

    // Initialize Bybit service
    const bybitService = new BybitService('', '', true);

    // Fetch user's Bybit credentials
    const { data: credentials, error: credentialsError } = await supabase
      .from('user_credentials')
      .select('bybit_api_key, bybit_secret_key')
      .eq('user_id', userId)
      .single();

    if (credentialsError || !credentials) {
      console.error('❌ Could not fetch Bybit credentials:', credentialsError);
      return false;
    }

    // Initialize Bybit service with credentials
    bybitService.initialize(credentials.bybit_api_key, credentials.bybit_secret_key, true);

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

    // Place market sell order with properly formatted quantity
    const sellOrderResult = await bybitService.placeSellOrder(
      trade.symbol,
      formattedQuantity,
      'market'
    );

    if (!sellOrderResult) {
      console.error(`❌ Failed to place sell order for trade ${tradeId}`);
      return false;
    }

    // Update trade status to closed
    const { error: updateError } = await supabase
      .from('trades')
      .update({ status: 'closed', close_reason: reason || 'Market Close' })
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
