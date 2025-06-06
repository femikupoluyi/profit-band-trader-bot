
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { ConfigurableFormatter } from './ConfigurableFormatter';
import { BybitInstrumentService } from './BybitInstrumentService';

export class OrderPlacer {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async placeRealBybitOrder(signal: any, quantity: number, entryPrice: number, takeProfitPrice: number): Promise<void> {
    try {
      console.log(`🔄 Placing REAL limit buy order with embedded TP on Bybit for ${signal.symbol}:`);
      console.log(`  Quantity: ${quantity}`);
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(4)}`);
      
      // Get instrument info for precise formatting
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(signal.symbol);
      if (!instrumentInfo) {
        throw new Error(`Failed to get instrument info for ${signal.symbol}`);
      }

      console.log(`📋 Using instrument info for ${signal.symbol}:`, instrumentInfo);

      // CRITICAL: Use Bybit instrument info for ALL price and quantity formatting
      const formattedQuantity = BybitInstrumentService.formatQuantity(signal.symbol, quantity, instrumentInfo);
      const formattedEntryPrice = BybitInstrumentService.formatPrice(signal.symbol, entryPrice, instrumentInfo);
      const formattedTakeProfitPrice = BybitInstrumentService.formatPrice(signal.symbol, takeProfitPrice, instrumentInfo);

      console.log(`  🔧 Formatted Quantity: ${formattedQuantity} (${instrumentInfo.quantityDecimals} decimals)`);
      console.log(`  🔧 Formatted Entry Price: ${formattedEntryPrice} (${instrumentInfo.priceDecimals} decimals)`);
      console.log(`  🔧 Formatted Take Profit Price: ${formattedTakeProfitPrice} (${instrumentInfo.priceDecimals} decimals)`);

      // Validate the order meets Bybit requirements
      if (!BybitInstrumentService.validateOrder(signal.symbol, parseFloat(formattedEntryPrice), parseFloat(formattedQuantity), instrumentInfo)) {
        throw new Error(`Order validation failed for ${signal.symbol}`);
      }

      // Place buy order with embedded take-profit using Bybit's TP functionality
      const buyOrderParams = {
        category: 'spot' as const,
        symbol: signal.symbol,
        side: 'Buy' as const,
        orderType: 'Limit' as const,
        qty: formattedQuantity,
        price: formattedEntryPrice,
        timeInForce: 'GTC' as const,
        // Embed take-profit in the buy order
        takeProfit: formattedTakeProfitPrice
      };

      console.log('📝 Placing REAL BUY order with embedded TP:', buyOrderParams);
      const buyOrderResult = await this.bybitService.placeOrder(buyOrderParams);

      if (buyOrderResult && buyOrderResult.retCode === 0 && buyOrderResult.result?.orderId) {
        const bybitBuyOrderId = buyOrderResult.result.orderId;
        console.log(`✅ REAL Bybit BUY order with embedded TP placed successfully: ${bybitBuyOrderId}`);

        // Create trade record for the buy order
        const { data: trade, error } = await supabase
          .from('trades')
          .insert({
            user_id: this.userId,
            symbol: signal.symbol,
            side: 'buy',
            order_type: 'limit',
            price: parseFloat(formattedEntryPrice),
            quantity: parseFloat(formattedQuantity),
            status: 'pending',
            bybit_order_id: bybitBuyOrderId,
            buy_order_id: bybitBuyOrderId,
            tp_price: parseFloat(formattedTakeProfitPrice),
          })
          .select()
          .single();

        if (error) throw error;

        console.log(`✅ Trade record created for REAL Bybit buy order with embedded TP: ${bybitBuyOrderId}`);
        
        await this.logActivity('order_placed', `REAL limit buy order with embedded TP placed on Bybit for ${signal.symbol}`, {
          symbol: signal.symbol,
          quantity: formattedQuantity,
          entryPrice: parseFloat(formattedEntryPrice),
          takeProfitPrice: parseFloat(formattedTakeProfitPrice),
          formattedPrice: formattedEntryPrice,
          orderValue: parseFloat(formattedQuantity) * parseFloat(formattedEntryPrice),
          bybitOrderId: bybitBuyOrderId,
          tradeId: trade.id,
          orderType: 'REAL_BYBIT_LIMIT_ORDER_WITH_TP',
          instrumentInfo: {
            priceDecimals: instrumentInfo.priceDecimals,
            quantityDecimals: instrumentInfo.quantityDecimals,
            tickSize: instrumentInfo.tickSize,
            basePrecision: instrumentInfo.basePrecision
          }
        });

      } else {
        console.error(`❌ Bybit order FAILED - retCode: ${buyOrderResult?.retCode}, retMsg: ${buyOrderResult?.retMsg}`);
        throw new Error(`Bybit order failed: ${buyOrderResult?.retMsg || 'Unknown error'}`);
      }

    } catch (error) {
      console.error(`❌ Error placing REAL order with embedded TP for ${signal.symbol}:`, error);
      throw error;
    }
  }

  // Query Bybit for the auto-generated TP sell order after buy fill
  async findAndLinkTakeProfitOrder(filledBuyTrade: any): Promise<void> {
    try {
      console.log(`🔍 Looking for auto-generated TP sell order for ${filledBuyTrade.symbol}`);
      
      // Query Bybit for open sell orders for this symbol
      const openOrdersResponse = await this.bybitService.getOpenOrders({
        category: 'spot',
        symbol: filledBuyTrade.symbol
      });

      if (openOrdersResponse && openOrdersResponse.retCode === 0 && openOrdersResponse.result?.list) {
        // Find the sell order that matches our TP price
        const sellOrders = openOrdersResponse.result.list.filter((order: any) => 
          order.side === 'Sell' && 
          parseFloat(order.price) === filledBuyTrade.tp_price
        );

        if (sellOrders.length > 0) {
          const sellOrder = sellOrders[0];
          console.log(`✅ Found auto-generated TP sell order: ${sellOrder.orderId}`);

          // Update the trade record with sell order information
          const { error: updateError } = await supabase
            .from('trades')
            .update({
              sell_order_id: sellOrder.orderId,
              sell_status: 'pending',
              buy_fill_price: filledBuyTrade.price,
              updated_at: new Date().toISOString()
            })
            .eq('id', filledBuyTrade.id);

          if (updateError) {
            console.error(`❌ Error updating trade with sell order info:`, updateError);
            throw updateError;
          }

          console.log(`✅ Trade record updated with TP sell order: ${sellOrder.orderId}`);
          
          await this.logActivity('order_linked', `Auto-generated TP sell order linked for ${filledBuyTrade.symbol}`, {
            symbol: filledBuyTrade.symbol,
            buyOrderId: filledBuyTrade.buy_order_id,
            sellOrderId: sellOrder.orderId,
            tpPrice: filledBuyTrade.tp_price,
            buyFillPrice: filledBuyTrade.price,
            tradeId: filledBuyTrade.id
          });
        } else {
          console.warn(`⚠️ No matching TP sell order found for ${filledBuyTrade.symbol} with TP price ${filledBuyTrade.tp_price}`);
          
          await this.logActivity('order_not_found', `Auto-generated TP sell order not found for ${filledBuyTrade.symbol}`, {
            symbol: filledBuyTrade.symbol,
            expectedTpPrice: filledBuyTrade.tp_price,
            tradeId: filledBuyTrade.id
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error finding TP sell order for ${filledBuyTrade.symbol}:`, error);
      await this.logActivity('order_search_failed', `Failed to find TP sell order for ${filledBuyTrade.symbol}`, {
        symbol: filledBuyTrade.symbol,
        error: error instanceof Error ? error.message : 'Unknown error',
        tradeId: filledBuyTrade.id
      });
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: type,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
