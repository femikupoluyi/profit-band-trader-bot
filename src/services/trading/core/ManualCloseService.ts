
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { ConfigurableFormatter } from './ConfigurableFormatter';

export class ManualCloseService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
  }

  async closePosition(tradeId: string): Promise<{ success: boolean; message: string; data?: any }> {
    let trade: any = null;
    
    try {
      console.log(`🔄 Manual close requested for trade ${tradeId}`);
      
      // Step 1: Get trade details from database
      const { data: tradeData, error: fetchError } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('user_id', this.userId)
        .single();

      if (fetchError || !tradeData) {
        const errorMsg = `Trade ${tradeId} not found: ${fetchError?.message || 'No data'}`;
        console.error(`❌ ${errorMsg}`);
        await this.logger.logError('Manual close failed - trade not found', new Error(errorMsg), { tradeId });
        return { success: false, message: errorMsg };
      }

      trade = tradeData;

      if (trade.status === 'closed') {
        const message = `Trade ${tradeId} is already closed`;
        console.log(`ℹ️ ${message}`);
        return { success: false, message };
      }

      if (trade.status !== 'filled') {
        const errorMsg = `Cannot close trade ${tradeId}: status is ${trade.status}, expected 'filled'`;
        console.error(`❌ ${errorMsg}`);
        await this.logger.logError('Manual close failed - invalid status', new Error(errorMsg), { 
          tradeId, 
          currentStatus: trade.status 
        });
        return { success: false, message: errorMsg };
      }

      // Step 2: Get current market price for reference
      let currentPrice: number;
      try {
        const marketData = await this.bybitService.getMarketPrice(trade.symbol);
        currentPrice = marketData.price;
        console.log(`📊 Current market price for ${trade.symbol}: $${currentPrice}`);
      } catch (priceError) {
        console.error(`⚠️ Could not fetch current price for ${trade.symbol}:`, priceError);
        // Use entry price as fallback for calculation purposes
        currentPrice = parseFloat(trade.price.toString());
      }

      // Step 3: Format quantity for Bybit API
      const quantity = parseFloat(trade.quantity.toString());
      const formattedQuantity = await ConfigurableFormatter.formatQuantity(trade.symbol, quantity);

      // Step 4: Prepare Bybit close order (market sell for buy positions)
      const closeOrderParams = {
        category: 'spot' as const,
        symbol: trade.symbol,
        side: 'Sell' as const, // Sell to close a buy position
        orderType: 'Market' as const,
        qty: formattedQuantity
      };

      console.log(`📝 Preparing Bybit close order for ${trade.symbol}:`, closeOrderParams);

      // Step 5: Execute close order on Bybit
      let bybitResponse: any;
      try {
        bybitResponse = await this.bybitService.placeOrder(closeOrderParams);
        console.log(`📡 Bybit close order response:`, bybitResponse);
      } catch (bybitError) {
        const errorMsg = `Bybit API call failed for ${trade.symbol}: ${bybitError instanceof Error ? bybitError.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`, bybitError);
        
        await this.logger.logError('Manual close failed - Bybit API error', bybitError, {
          tradeId,
          symbol: trade.symbol,
          orderParams: closeOrderParams,
          apiUrl: '/v5/order/create',
          payload: closeOrderParams
        });
        
        return { success: false, message: errorMsg };
      }

      // Step 6: Validate Bybit response
      if (!bybitResponse || bybitResponse.retCode !== 0) {
        const errorMsg = `Bybit order failed for ${trade.symbol}: ${bybitResponse?.retMsg || 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`, bybitResponse);
        
        await this.logger.logError('Manual close failed - Bybit order rejected', new Error(errorMsg), {
          tradeId,
          symbol: trade.symbol,
          bybitResponse,
          retCode: bybitResponse?.retCode,
          retMsg: bybitResponse?.retMsg
        });
        
        return { success: false, message: errorMsg };
      }

      const bybitOrderId = bybitResponse.result?.orderId;
      if (!bybitOrderId) {
        const errorMsg = `Bybit order succeeded but no order ID returned for ${trade.symbol}`;
        console.error(`❌ ${errorMsg}`, bybitResponse);
        
        await this.logger.logError('Manual close failed - no order ID', new Error(errorMsg), {
          tradeId,
          symbol: trade.symbol,
          bybitResponse
        });
        
        return { success: false, message: errorMsg };
      }

      console.log(`✅ Bybit close order placed successfully: Order ID ${bybitOrderId}`);

      // Step 7: Calculate P&L
      const entryPrice = parseFloat(trade.price.toString());
      const profitLoss = (currentPrice - entryPrice) * quantity;

      // Step 8: Update local database - mark as closed
      const { error: updateError } = await supabase
        .from('trades')
        .update({
          status: 'closed',
          profit_loss: profitLoss,
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId)
        .eq('status', 'filled'); // Only update if still filled (prevent race conditions)

      if (updateError) {
        // Critical: Bybit order succeeded but database update failed
        const errorMsg = `CRITICAL: Bybit close succeeded but database update failed for trade ${tradeId}`;
        console.error(`🚨 ${errorMsg}`, updateError);
        
        await this.logger.logError('Manual close - database update failed after Bybit success', updateError, {
          tradeId,
          symbol: trade.symbol,
          bybitOrderId,
          profitLoss,
          warning: 'Position closed on Bybit but not in local database - manual intervention required'
        });
        
        return { 
          success: false, 
          message: `${errorMsg}. Position may be closed on exchange but not updated locally. Contact support.` 
        };
      }

      // Step 9: Log successful close
      await this.logger.log('position_closed', `Manual close executed successfully for ${trade.symbol}`, {
        tradeId,
        symbol: trade.symbol,
        side: trade.side,
        entryPrice,
        closePrice: currentPrice,
        quantity: formattedQuantity,
        profitLoss,
        bybitOrderId,
        closedAt: new Date().toISOString(),
        method: 'manual_api_close'
      });

      const successMessage = `Position closed successfully: ${trade.symbol} P&L: $${profitLoss.toFixed(2)}`;
      console.log(`✅ ${successMessage}`);

      return { 
        success: true, 
        message: successMessage, 
        data: { 
          profitLoss, 
          bybitOrderId, 
          closePrice: currentPrice 
        } 
      };

    } catch (error) {
      const errorMsg = `Unexpected error during manual close for trade ${tradeId}`;
      console.error(`❌ ${errorMsg}:`, error);
      
      await this.logger.logError(errorMsg, error, {
        tradeId,
        symbol: trade?.symbol,
        step: 'unknown',
        fullError: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      
      return { 
        success: false, 
        message: `${errorMsg}: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}
