import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { PriceFormatter } from './PriceFormatter';
import { ConfigurableFormatter } from './ConfigurableFormatter';

export class OrderPlacer {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async placeRealBybitOrder(signal: any, quantity: number, entryPrice: number, takeProfitPrice: number): Promise<void> {
    try {
      console.log(`🔄 Placing REAL limit buy order on Bybit for ${signal.symbol}:`);
      console.log(`  Quantity: ${quantity}`);
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(4)}`);
      
      // CRITICAL: Use ConfigurableFormatter for ALL price and quantity formatting
      const formattedQuantity = ConfigurableFormatter.formatQuantity(signal.symbol, quantity);
      const formattedEntryPrice = ConfigurableFormatter.formatPrice(signal.symbol, entryPrice);

      console.log(`  🔧 Formatted Quantity: ${formattedQuantity}`);
      console.log(`  🔧 Formatted Entry Price: ${formattedEntryPrice}`);

      // Validate the formatted values
      if (!ConfigurableFormatter.validateFormatting(signal.symbol, parseFloat(formattedEntryPrice), parseFloat(formattedQuantity))) {
        throw new Error(`Invalid formatting for ${signal.symbol}: price=${formattedEntryPrice}, quantity=${formattedQuantity}`);
      }

      // ALWAYS place real Bybit order - no fallback to mock
      const buyOrderParams = {
        category: 'spot' as const,
        symbol: signal.symbol,
        side: 'Buy' as const,
        orderType: 'Limit' as const,
        qty: formattedQuantity,
        price: formattedEntryPrice,
        timeInForce: 'GTC' as const
      };

      console.log('📝 Placing REAL BUY order with formatted values:', buyOrderParams);
      const buyOrderResult = await this.bybitService.placeOrder(buyOrderParams);

      if (buyOrderResult && buyOrderResult.retCode === 0 && buyOrderResult.result?.orderId) {
        const bybitOrderId = buyOrderResult.result.orderId;
        console.log(`✅ REAL Bybit BUY order placed successfully: ${bybitOrderId}`);

        // Create trade record ONLY after successful Bybit order placement
        const { data: trade, error } = await supabase
          .from('trades')
          .insert({
            user_id: this.userId,
            symbol: signal.symbol,
            side: 'buy',
            order_type: 'limit',
            price: parseFloat(formattedEntryPrice), // Use the formatted price value
            quantity: parseFloat(formattedQuantity), // Use the formatted quantity value
            status: 'pending', // Real orders start as pending until Bybit confirms fill
            bybit_order_id: bybitOrderId,
          })
          .select()
          .single();

        if (error) throw error;

        console.log(`✅ Trade record created for REAL Bybit order ${bybitOrderId}`);
        
        await this.logActivity('order_placed', `REAL limit buy order placed on Bybit for ${signal.symbol}`, {
          symbol: signal.symbol,
          quantity: formattedQuantity,
          entryPrice: parseFloat(formattedEntryPrice),
          formattedPrice: formattedEntryPrice,
          takeProfitPrice: takeProfitPrice,
          orderValue: parseFloat(formattedQuantity) * parseFloat(formattedEntryPrice),
          bybitOrderId,
          tradeId: trade.id,
          orderType: 'REAL_BYBIT_LIMIT_ORDER'
        });

        // CRITICAL: Place take-profit limit sell order after successful buy order
        await this.placeTakeProfitOrder(signal.symbol, parseFloat(formattedQuantity), takeProfitPrice, trade.id);

      } else {
        console.error(`❌ Bybit order FAILED - retCode: ${buyOrderResult?.retCode}, retMsg: ${buyOrderResult?.retMsg}`);
        throw new Error(`Bybit order failed: ${buyOrderResult?.retMsg || 'Unknown error'}`);
      }

    } catch (error) {
      console.error(`❌ Error placing REAL order for ${signal.symbol}:`, error);
      throw error;
    }
  }

  private async placeTakeProfitOrder(symbol: string, quantity: number, takeProfitPrice: number, relatedTradeId: string): Promise<void> {
    try {
      console.log(`🎯 Placing take-profit limit sell order for ${symbol}`);
      
      // CRITICAL: Use ConfigurableFormatter for take-profit price formatting
      const formattedTakeProfitPrice = ConfigurableFormatter.formatPrice(symbol, takeProfitPrice);
      const formattedQuantity = ConfigurableFormatter.formatQuantity(symbol, quantity);
      
      console.log(`  🔧 Formatted Take-Profit Price: ${formattedTakeProfitPrice}`);
      console.log(`  🔧 Formatted Quantity: ${formattedQuantity}`);
      
      // Validate the formatted take-profit price
      if (!ConfigurableFormatter.validateFormatting(symbol, parseFloat(formattedTakeProfitPrice), parseFloat(formattedQuantity))) {
        throw new Error(`Invalid take-profit formatting for ${symbol}: price=${formattedTakeProfitPrice}, quantity=${formattedQuantity}`);
      }
      
      const sellOrderParams = {
        category: 'spot' as const,
        symbol: symbol,
        side: 'Sell' as const,
        orderType: 'Limit' as const,
        qty: formattedQuantity,
        price: formattedTakeProfitPrice,
        timeInForce: 'GTC' as const
      };

      console.log('📝 Placing take-profit SELL order with formatted values:', sellOrderParams);
      const sellOrderResult = await this.bybitService.placeOrder(sellOrderParams);
      
      if (sellOrderResult && sellOrderResult.retCode === 0 && sellOrderResult.result?.orderId) {
        console.log(`✅ Take-profit order placed: ${sellOrderResult.result.orderId}`);
        
        // Create a separate trade record for the take-profit order
        const { data: takeProfitTrade, error: tpError } = await supabase
          .from('trades')
          .insert({
            user_id: this.userId,
            symbol: symbol,
            side: 'sell',
            order_type: 'limit',
            price: parseFloat(formattedTakeProfitPrice), // Use formatted price
            quantity: parseFloat(formattedQuantity),
            status: 'pending',
            bybit_order_id: sellOrderResult.result.orderId,
          })
          .select()
          .single();

        if (tpError) {
          console.error('Error creating take-profit trade record:', tpError);
        } else {
          console.log(`✅ Take-profit trade record created: ${takeProfitTrade.id}`);
        }
        
        await this.logActivity('order_placed', `Take-profit limit sell order placed for ${symbol}`, {
          symbol,
          quantity: formattedQuantity,
          takeProfitPrice: parseFloat(formattedTakeProfitPrice),
          formattedPrice: formattedTakeProfitPrice,
          bybitOrderId: sellOrderResult.result.orderId,
          relatedTradeId,
          orderType: 'TAKE_PROFIT_LIMIT_SELL'
        });
      } else {
        console.log(`⚠️ Take-profit order failed: ${sellOrderResult?.retMsg}`);
        
        await this.logActivity('order_failed', `Take-profit order failed for ${symbol}`, {
          symbol,
          error: sellOrderResult?.retMsg || 'Unknown error',
          formattedPrice: formattedTakeProfitPrice,
          originalPrice: takeProfitPrice,
          formattedQuantity: formattedQuantity,
          relatedTradeId
        });
      }
    } catch (error) {
      console.error(`❌ Error placing take-profit order for ${symbol}:`, error);
      await this.logActivity('order_failed', `Take-profit order error for ${symbol}`, {
        symbol,
        error: error.message,
        relatedTradeId
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
