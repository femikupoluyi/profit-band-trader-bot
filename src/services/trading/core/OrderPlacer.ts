
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';

export class OrderPlacer {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService, logger: TradingLogger) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = logger;
  }

  async placeOrderWithTP(
    symbol: string,
    side: 'Buy' | 'Sell',
    quantity: string,
    price: string,
    tpPrice?: string
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      console.log(`🔄 Placing ${side} order for ${symbol}: qty=${quantity}, price=${price}, tp=${tpPrice}`);

      // Prepare order parameters with embedded TP
      const orderParams: any = {
        category: 'spot',
        symbol,
        side,
        orderType: 'Limit',
        qty: quantity,
        price: price,
      };

      // Add take-profit if provided (for buy orders)
      if (side === 'Buy' && tpPrice) {
        orderParams.takeProfit = tpPrice;
        console.log(`📈 Adding take-profit to buy order: ${tpPrice}`);
      }

      // Place order on Bybit
      const response = await this.bybitService.placeOrder(orderParams);
      
      if (response.retCode !== 0 || !response.result?.orderId) {
        await this.logger.logError('Order placement failed', new Error(`Bybit error: ${response.retMsg}`), {
          symbol,
          side,
          quantity,
          price,
          tpPrice,
          response
        });
        return { success: false, error: response.retMsg || 'Unknown error' };
      }

      const orderId = response.result.orderId;
      console.log(`✅ Order placed successfully: ${orderId}`);

      await this.logger.logSuccess(`Order placed: ${side} ${quantity} ${symbol} at ${price}`, {
        orderId,
        symbol,
        side,
        quantity,
        price,
        tpPrice,
        hasEmbeddedTP: !!tpPrice
      });

      return { success: true, orderId };

    } catch (error) {
      await this.logger.logError('Order placement exception', error, {
        symbol,
        side,
        quantity,
        price,
        tpPrice
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async storeTrade(
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price: number,
    orderId: string,
    tpPrice?: number
  ): Promise<{ success: boolean; tradeId?: string; error?: string }> {
    try {
      console.log(`💾 Storing trade: ${side} ${quantity} ${symbol} at ${price}, orderId=${orderId}`);

      const tradeData: any = {
        user_id: this.userId,
        symbol,
        side,
        quantity,
        price,
        status: 'pending',
        order_type: 'limit',
        bybit_order_id: orderId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // For buy orders with TP, store the TP price and set initial values
      if (side === 'buy' && tpPrice) {
        tradeData.buy_order_id = orderId;
        tradeData.tp_price = tpPrice;
        tradeData.sell_status = 'pending'; // Will be updated when we find the auto-generated sell order
        console.log(`📊 Storing buy order with TP: ${tpPrice}`);
      }

      const { data, error } = await supabase
        .from('trades')
        .insert(tradeData)
        .select('id')
        .single();

      if (error) {
        await this.logger.logError('Failed to store trade', error, tradeData);
        return { success: false, error: error.message };
      }

      console.log(`✅ Trade stored with ID: ${data.id}`);
      return { success: true, tradeId: data.id };

    } catch (error) {
      await this.logger.logError('Store trade exception', error, {
        symbol,
        side,
        quantity,
        price,
        orderId,
        tpPrice
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async findAndLinkTPOrder(tradeId: string, symbol: string): Promise<void> {
    try {
      console.log(`🔍 Searching for auto-generated TP sell order for ${symbol}`);

      // Get open orders for this symbol
      const openOrders = await this.bybitService.getOpenOrders(symbol);
      
      if (openOrders.retCode !== 0 || !openOrders.result?.list) {
        console.log(`⚠️ Failed to get open orders for ${symbol}: ${openOrders.retMsg}`);
        return;
      }

      // Look for sell orders (auto-generated TP orders)
      const sellOrders = openOrders.result.list.filter((order: any) => 
        order.side === 'Sell' && order.symbol === symbol
      );

      if (sellOrders.length === 0) {
        console.log(`ℹ️ No sell orders found for ${symbol} yet`);
        return;
      }

      // Take the most recent sell order (likely the auto-generated TP)
      const tpOrder = sellOrders[0];
      const sellOrderId = tpOrder.orderId;
      const tpPrice = parseFloat(tpOrder.price);

      console.log(`🎯 Found potential TP sell order: ${sellOrderId} at ${tpPrice}`);

      // Update the trade record with sell order details
      const { error } = await supabase
        .from('trades')
        .update({
          sell_order_id: sellOrderId,
          tp_price: tpPrice,
          sell_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId);

      if (error) {
        await this.logger.logError('Failed to link TP order', error, {
          tradeId,
          sellOrderId,
          tpPrice
        });
        return;
      }

      console.log(`✅ Linked TP sell order ${sellOrderId} to trade ${tradeId}`);
      
      await this.logger.logSuccess(`Linked auto-generated TP order for ${symbol}`, {
        tradeId,
        sellOrderId,
        tpPrice,
        symbol
      });

    } catch (error) {
      await this.logger.logError('Find TP order exception', error, {
        tradeId,
        symbol
      });
    }
  }
}
