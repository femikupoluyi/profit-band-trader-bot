
import { BybitService } from '../../bybitService';
import { OrderFormatter } from './OrderFormatter';
import { TradeRecorder } from './TradeRecorder';

interface OrderResult {
  success: boolean;
  orderId?: string;
  reason?: string;
}

interface CalculatedOrderData {
  quantity: number;
  entryPrice: number;
  takeProfitPrice: number;
}

export class OrderPlacer {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async placeOrder(symbol: string, calculatedData: CalculatedOrderData): Promise<OrderResult> {
    try {
      await this.placeRealBybitOrder(
        { symbol }, // Mock signal object with symbol
        calculatedData.quantity,
        calculatedData.entryPrice,
        calculatedData.takeProfitPrice
      );
      return { success: true };
    } catch (error) {
      console.error(`❌ Error placing order for ${symbol}:`, error);
      return { success: false, reason: error.message };
    }
  }

  async placeRealBybitOrder(signal: any, quantity: number, entryPrice: number, takeProfitPrice: number): Promise<void> {
    try {
      console.log(`🔄 Placing REAL limit buy order on Bybit for ${signal.symbol}:`);
      console.log(`  Quantity: ${quantity}`);
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(4)}`);
      
      // Format the buy order
      const formattedOrder = await OrderFormatter.formatBuyOrder(signal.symbol, quantity, entryPrice);

      // ALWAYS place real Bybit order - no fallback to mock
      const buyOrderParams = {
        category: 'spot' as const,
        symbol: signal.symbol,
        side: 'Buy' as const,
        orderType: 'Limit' as const,
        qty: formattedOrder.quantity,
        price: formattedOrder.price,
        timeInForce: 'GTC' as const
      };

      console.log('📝 Placing REAL BUY order with Bybit-compliant formatting:', buyOrderParams);
      const buyOrderResult = await this.bybitService.placeOrder(buyOrderParams);

      if (buyOrderResult && buyOrderResult.retCode === 0 && buyOrderResult.result?.orderId) {
        const bybitOrderId = buyOrderResult.result.orderId;
        console.log(`✅ REAL Bybit BUY order placed successfully: ${bybitOrderId}`);

        // Create trade record ONLY after successful Bybit order placement
        const trade = await TradeRecorder.createTradeRecord({
          userId: this.userId,
          symbol: signal.symbol,
          side: 'buy',
          orderType: 'limit',
          price: parseFloat(formattedOrder.price),
          quantity: parseFloat(formattedOrder.quantity),
          status: 'pending',
          bybitOrderId
        });

        console.log(`✅ Trade record created for REAL Bybit order ${bybitOrderId}`);
        
        await TradeRecorder.logActivity(this.userId, 'order_placed', `REAL limit buy order placed on Bybit for ${signal.symbol}`, {
          symbol: signal.symbol,
          quantity: formattedOrder.quantity,
          entryPrice: parseFloat(formattedOrder.price),
          formattedPrice: formattedOrder.price,
          takeProfitPrice: takeProfitPrice,
          orderValue: parseFloat(formattedOrder.quantity) * parseFloat(formattedOrder.price),
          bybitOrderId,
          tradeId: trade.id,
          orderType: 'REAL_BYBIT_LIMIT_ORDER',
          instrumentInfo: {
            priceDecimals: formattedOrder.instrumentInfo.priceDecimals,
            quantityDecimals: formattedOrder.instrumentInfo.quantityDecimals,
            tickSize: formattedOrder.instrumentInfo.tickSize,
            basePrecision: formattedOrder.instrumentInfo.basePrecision
          }
        });

        // CRITICAL: Place take-profit limit sell order after successful buy order
        await this.placeTakeProfitOrder(signal.symbol, parseFloat(formattedOrder.quantity), takeProfitPrice, trade.id, formattedOrder.instrumentInfo);

      } else {
        console.error(`❌ Bybit order FAILED - retCode: ${buyOrderResult?.retCode}, retMsg: ${buyOrderResult?.retMsg}`);
        throw new Error(`Bybit order failed: ${buyOrderResult?.retMsg || 'Unknown error'}`);
      }

    } catch (error) {
      console.error(`❌ Error placing REAL order for ${signal.symbol}:`, error);
      throw error;
    }
  }

  private async placeTakeProfitOrder(symbol: string, quantity: number, takeProfitPrice: number, relatedTradeId: string, instrumentInfo: any): Promise<void> {
    try {
      console.log(`🎯 Placing take-profit limit sell order for ${symbol}`);
      
      // Format the sell order
      const formattedOrder = await OrderFormatter.formatSellOrder(symbol, quantity, takeProfitPrice, instrumentInfo);
      
      const sellOrderParams = {
        category: 'spot' as const,
        symbol: symbol,
        side: 'Sell' as const,
        orderType: 'Limit' as const,
        qty: formattedOrder.quantity,
        price: formattedOrder.price,
        timeInForce: 'GTC' as const
      };

      console.log('📝 Placing take-profit SELL order with Bybit-compliant formatting:', sellOrderParams);
      const sellOrderResult = await this.bybitService.placeOrder(sellOrderParams);
      
      if (sellOrderResult && sellOrderResult.retCode === 0 && sellOrderResult.result?.orderId) {
        console.log(`✅ Take-profit order placed: ${sellOrderResult.result.orderId}`);
        
        // Create a separate trade record for the take-profit order
        const takeProfitTrade = await TradeRecorder.createTradeRecord({
          userId: this.userId,
          symbol: symbol,
          side: 'sell',
          orderType: 'limit',
          price: parseFloat(formattedOrder.price),
          quantity: parseFloat(formattedOrder.quantity),
          status: 'pending',
          bybitOrderId: sellOrderResult.result.orderId
        });

        console.log(`✅ Take-profit trade record created: ${takeProfitTrade.id}`);
        
        await TradeRecorder.logActivity(this.userId, 'order_placed', `Take-profit limit sell order placed for ${symbol}`, {
          symbol,
          quantity: formattedOrder.quantity,
          takeProfitPrice: parseFloat(formattedOrder.price),
          formattedPrice: formattedOrder.price,
          bybitOrderId: sellOrderResult.result.orderId,
          relatedTradeId,
          orderType: 'TAKE_PROFIT_LIMIT_SELL',
          instrumentInfo: {
            priceDecimals: instrumentInfo.priceDecimals,
            quantityDecimals: instrumentInfo.quantityDecimals,
            tickSize: instrumentInfo.tickSize,
            basePrecision: instrumentInfo.basePrecision
          }
        });
      } else {
        console.log(`⚠️ Take-profit order failed: ${sellOrderResult?.retMsg}`);
        
        await TradeRecorder.logActivity(this.userId, 'order_failed', `Take-profit order failed for ${symbol}`, {
          symbol,
          error: sellOrderResult?.retMsg || 'Unknown error',
          formattedPrice: formattedOrder.price,
          originalPrice: takeProfitPrice,
          formattedQuantity: formattedOrder.quantity,
          relatedTradeId
        });
      }
    } catch (error) {
      console.error(`❌ Error placing take-profit order for ${symbol}:`, error);
      await TradeRecorder.logActivity(this.userId, 'order_failed', `Take-profit order error for ${symbol}`, {
        symbol,
        error: error.message,
        relatedTradeId
      });
    }
  }
}
