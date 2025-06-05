
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';

export class ManualCloseService {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async closePosition(tradeId: string): Promise<void> {
    try {
      console.log(`🔄 MANUAL CLOSE SERVICE - Starting for trade ${tradeId}`);

      // Enhanced initial logging
      await this.logActivity('signal_processed', `[MANUAL CLOSE] Starting manual close for trade ${tradeId}`, { 
        tradeId,
        action: 'manual_close_service_start',
        timestamp: new Date().toISOString()
      });

      // Get the trade details with enhanced error handling
      console.log(`🔍 Fetching trade details for ${tradeId}...`);
      const { data: trade, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('user_id', this.userId)
        .single();

      if (error) {
        const errorMsg = `Database error fetching trade ${tradeId}: ${error.message}`;
        console.error('❌ Database error:', error);
        await this.logActivity('system_error', `[MANUAL CLOSE] ${errorMsg}`, { 
          tradeId, 
          error: error.message,
          errorCode: error.code,
          action: 'trade_fetch_database_error'
        });
        throw new Error(errorMsg);
      }

      if (!trade) {
        const errorMsg = `Trade not found for manual close: ${tradeId}`;
        console.error('❌ Trade not found');
        await this.logActivity('system_error', `[MANUAL CLOSE] ${errorMsg}`, { 
          tradeId,
          action: 'trade_not_found'
        });
        throw new Error(errorMsg);
      }

      console.log(`📊 Trade found: ${trade.symbol}, Status: ${trade.status}, Entry: $${trade.price}, Qty: ${trade.quantity}`);
      await this.logActivity('signal_processed', `[MANUAL CLOSE] Trade found: ${trade.symbol} (${trade.status})`, {
        tradeId,
        symbol: trade.symbol,
        status: trade.status,
        entryPrice: trade.price,
        quantity: trade.quantity,
        action: 'trade_details_retrieved'
      });

      if (trade.status !== 'filled') {
        const errorMsg = `Cannot close trade that is not filled. Status: ${trade.status}`;
        console.error('❌ Invalid trade status:', trade.status);
        await this.logActivity('order_rejected', `[MANUAL CLOSE] ${errorMsg}`, { 
          tradeId, 
          currentStatus: trade.status,
          action: 'invalid_status_for_close'
        });
        throw new Error(errorMsg);
      }

      // Get current market price with enhanced error handling
      console.log(`📈 Getting current market price for ${trade.symbol}...`);
      await this.logActivity('signal_processed', `[MANUAL CLOSE] Fetching market price for ${trade.symbol}`, {
        tradeId,
        symbol: trade.symbol,
        action: 'fetching_market_price'
      });

      let marketData;
      try {
        marketData = await this.bybitService.getMarketPrice(trade.symbol);
        console.log(`✅ Market data received:`, marketData);
        await this.logActivity('signal_processed', `[MANUAL CLOSE] Market price retrieved: $${marketData.price}`, {
          tradeId,
          symbol: trade.symbol,
          marketPrice: marketData.price,
          action: 'market_price_retrieved'
        });
      } catch (priceError) {
        const errorMsg = `Failed to get market price for ${trade.symbol}: ${priceError instanceof Error ? priceError.message : 'Unknown error'}`;
        console.error('❌ Market price error:', priceError);
        await this.logActivity('system_error', `[MANUAL CLOSE] ${errorMsg}`, {
          tradeId,
          symbol: trade.symbol,
          error: priceError instanceof Error ? priceError.message : 'Unknown error',
          action: 'market_price_fetch_failed'
        });
        throw new Error(errorMsg);
      }

      const currentPrice = marketData.price;
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());
      const profit = (currentPrice - entryPrice) * quantity;

      console.log(`💰 P&L calculation: Entry=$${entryPrice}, Current=$${currentPrice}, Qty=${quantity}, P&L=$${profit.toFixed(2)}`);
      await this.logActivity('signal_processed', `[MANUAL CLOSE] P&L calculated: $${profit.toFixed(2)}`, {
        tradeId,
        symbol: trade.symbol,
        entryPrice,
        currentPrice,
        quantity,
        profit,
        profitPercent: ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2),
        action: 'pnl_calculated'
      });

      // Place MARKET sell order with enhanced logging
      const sellOrderParams = {
        category: 'spot' as const,
        symbol: trade.symbol,
        side: 'Sell' as const,
        orderType: 'Market' as const,
        qty: trade.quantity.toString(),
      };

      console.log('📝 Placing MARKET sell order:', sellOrderParams);
      await this.logActivity('signal_processed', `[MANUAL CLOSE] Placing market sell order`, {
        tradeId,
        symbol: trade.symbol,
        orderParams: sellOrderParams,
        expectedProfit: profit,
        action: 'placing_sell_order'
      });

      let sellResult;
      try {
        sellResult = await this.bybitService.placeOrder(sellOrderParams);
        console.log('✅ Bybit sell order response:', sellResult);
        await this.logActivity('signal_processed', `[MANUAL CLOSE] Bybit order response received`, {
          tradeId,
          symbol: trade.symbol,
          sellResult: {
            retCode: sellResult?.retCode,
            retMsg: sellResult?.retMsg,
            orderId: sellResult?.result?.orderId
          },
          action: 'bybit_order_response'
        });
      } catch (orderError) {
        const errorMsg = `Bybit order placement failed: ${orderError instanceof Error ? orderError.message : 'Unknown error'}`;
        console.error('❌ Bybit order error:', orderError);
        await this.logActivity('order_failed', `[MANUAL CLOSE] ${errorMsg}`, {
          tradeId,
          symbol: trade.symbol,
          error: orderError instanceof Error ? orderError.message : 'Unknown error',
          orderParams: sellOrderParams,
          action: 'bybit_order_exception'
        });
        throw new Error(errorMsg);
      }

      if (sellResult && sellResult.retCode === 0) {
        console.log(`✅ Market sell order placed successfully: ${sellResult.result?.orderId || 'No order ID'}`);
        await this.logActivity('order_placed', `[MANUAL CLOSE] Bybit order placed successfully`, {
          tradeId,
          symbol: trade.symbol,
          bybitOrderId: sellResult.result?.orderId,
          action: 'bybit_order_success'
        });

        // Update trade as closed
        console.log('📝 Updating trade status to closed in database...');
        const { error: updateError } = await supabase
          .from('trades')
          .update({
            status: 'closed',
            profit_loss: profit,
            updated_at: new Date().toISOString()
          })
          .eq('id', tradeId);

        if (updateError) {
          console.error('❌ Database update error:', updateError);
          await this.logActivity('system_error', `[MANUAL CLOSE] Database update failed`, {
            tradeId,
            symbol: trade.symbol,
            error: updateError.message,
            action: 'database_update_failed'
          });
          throw updateError;
        }

        console.log(`✅ Manual close completed: ${trade.symbol} P&L: $${profit.toFixed(2)}`);
        await this.logActivity('position_closed', `[MANUAL CLOSE] Position closed successfully: ${trade.symbol}`, {
          tradeId,
          symbol: trade.symbol,
          entryPrice,
          exitPrice: currentPrice,
          profit,
          profitPercent: ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2),
          reason: 'manual_close_market_order',
          bybitOrderId: sellResult.result?.orderId || null,
          action: 'manual_close_complete_success'
        });

        // Summary log for easy tracking
        console.log(`🎯 MANUAL CLOSE SUCCESS SUMMARY:`);
        console.log(`   Symbol: ${trade.symbol}`);
        console.log(`   Entry Price: $${entryPrice.toFixed(4)}`);
        console.log(`   Exit Price: $${currentPrice.toFixed(4)}`);
        console.log(`   Quantity: ${quantity}`);
        console.log(`   Profit: $${profit.toFixed(2)}`);
        console.log(`   Profit %: ${((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)}%`);

      } else {
        const errorMsg = `Bybit market order failed: ${sellResult?.retMsg || 'Unknown error'} (Code: ${sellResult?.retCode})`;
        console.error('❌ Bybit order failed:', errorMsg);
        await this.logActivity('order_failed', `[MANUAL CLOSE] ${errorMsg}`, {
          tradeId,
          symbol: trade.symbol,
          sellResult: sellResult,
          retCode: sellResult?.retCode,
          retMsg: sellResult?.retMsg,
          action: 'bybit_order_failed'
        });
        throw new Error(errorMsg);
      }

    } catch (error) {
      console.error(`❌ Error in manual close:`, error);
      await this.logActivity('system_error', `[MANUAL CLOSE] Manual close failed for trade ${tradeId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        tradeId,
        action: 'manual_close_failed'
      });
      throw error;
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      // Valid log types based on database constraints
      const validLogTypes = [
        'signal_processed',
        'trade_executed',
        'trade_filled', 
        'position_closed',
        'system_error',
        'order_placed',
        'order_failed',
        'calculation_error',
        'execution_error',
        'signal_rejected',
        'order_rejected'
      ];

      // Map any custom types to valid ones
      const typeMapping: Record<string, string> = {
        'manual_close': 'position_closed',
        'close_rejected': 'order_rejected',
        'close_error': 'execution_error',
        'trade_closed': 'position_closed'
      };

      const validType = typeMapping[type] || (validLogTypes.includes(type) ? type : 'system_error');

      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: validType,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('❌ Error logging activity:', error);
    }
  }
}
