
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
      console.log(`🔄 Placing REAL limit buy order on Bybit for ${signal.symbol}:`);
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

      console.log(`  🔧 Formatted Quantity: ${formattedQuantity} (${instrumentInfo.quantityDecimals} decimals)`);
      console.log(`  🔧 Formatted Entry Price: ${formattedEntryPrice} (${instrumentInfo.priceDecimals} decimals)`);

      // Validate the order meets Bybit requirements
      if (!BybitInstrumentService.validateOrder(signal.symbol, parseFloat(formattedEntryPrice), parseFloat(formattedQuantity), instrumentInfo)) {
        throw new Error(`Order validation failed for ${signal.symbol}`);
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

      console.log('📝 Placing REAL BUY order with Bybit-compliant formatting:', buyOrderParams);
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
            price: parseFloat(formattedEntryPrice), // Use the Bybit-formatted price value
            quantity: parseFloat(formattedQuantity), // Use the Bybit-formatted quantity value
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
          orderType: 'REAL_BYBIT_LIMIT_ORDER',
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
      console.error(`❌ Error placing REAL order for ${signal.symbol}:`, error);
      throw error;
    }
  }

  // GUARANTEED Take-Profit Order Creation - Called when buy order fills
  async createTakeProfitOrder(filledBuyTrade: any, takeProfitPercent: number): Promise<void> {
    try {
      console.log(`🎯 Creating guaranteed take-profit order for filled buy: ${filledBuyTrade.symbol}`);
      
      const entryPrice = parseFloat(filledBuyTrade.price.toString());
      const quantity = parseFloat(filledBuyTrade.quantity.toString());
      const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);

      // Get instrument info for precise formatting
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(filledBuyTrade.symbol);
      if (!instrumentInfo) {
        throw new Error(`Failed to get instrument info for ${filledBuyTrade.symbol}`);
      }
      
      // CRITICAL: Use Bybit instrument info for take-profit price formatting
      const formattedTakeProfitPrice = BybitInstrumentService.formatPrice(filledBuyTrade.symbol, takeProfitPrice, instrumentInfo);
      const formattedQuantity = BybitInstrumentService.formatQuantity(filledBuyTrade.symbol, quantity, instrumentInfo);
      
      console.log(`  🔧 Formatted Take-Profit Price: ${formattedTakeProfitPrice} (${instrumentInfo.priceDecimals} decimals)`);
      console.log(`  🔧 Formatted Quantity: ${formattedQuantity} (${instrumentInfo.quantityDecimals} decimals)`);
      
      // Validate the formatted take-profit order
      if (!BybitInstrumentService.validateOrder(filledBuyTrade.symbol, parseFloat(formattedTakeProfitPrice), parseFloat(formattedQuantity), instrumentInfo)) {
        throw new Error(`Take-profit order validation failed for ${filledBuyTrade.symbol}`);
      }
      
      const sellOrderParams = {
        category: 'spot' as const,
        symbol: filledBuyTrade.symbol,
        side: 'Sell' as const,
        orderType: 'Limit' as const,
        qty: formattedQuantity,
        price: formattedTakeProfitPrice,
        timeInForce: 'GTC' as const
      };

      console.log('📝 Placing guaranteed take-profit SELL order:', sellOrderParams);
      const sellOrderResult = await this.bybitService.placeOrder(sellOrderParams);
      
      if (sellOrderResult && sellOrderResult.retCode === 0 && sellOrderResult.result?.orderId) {
        console.log(`✅ Take-profit order placed: ${sellOrderResult.result.orderId}`);
        
        // Create a separate trade record for the take-profit order
        const { data: takeProfitTrade, error: tpError } = await supabase
          .from('trades')
          .insert({
            user_id: this.userId,
            symbol: filledBuyTrade.symbol,
            side: 'sell',
            order_type: 'limit',
            price: parseFloat(formattedTakeProfitPrice),
            quantity: parseFloat(formattedQuantity),
            status: 'pending',
            bybit_order_id: sellOrderResult.result.orderId,
          })
          .select()
          .single();

        if (tpError) {
          console.error('Error creating take-profit trade record:', tpError);
          throw tpError;
        } else {
          console.log(`✅ Take-profit trade record created: ${takeProfitTrade.id}`);
        }
        
        await this.logActivity('order_placed', `Guaranteed take-profit order placed for ${filledBuyTrade.symbol}`, {
          symbol: filledBuyTrade.symbol,
          quantity: formattedQuantity,
          takeProfitPrice: parseFloat(formattedTakeProfitPrice),
          formattedPrice: formattedTakeProfitPrice,
          bybitOrderId: sellOrderResult.result.orderId,
          relatedBuyTradeId: filledBuyTrade.id,
          orderType: 'GUARANTEED_TAKE_PROFIT_SELL',
          instrumentInfo: {
            priceDecimals: instrumentInfo.priceDecimals,
            quantityDecimals: instrumentInfo.quantityDecimals,
            tickSize: instrumentInfo.tickSize,
            basePrecision: instrumentInfo.basePrecision
          }
        });
      } else {
        console.error(`❌ Take-profit order failed: ${sellOrderResult?.retMsg}`);
        throw new Error(`Take-profit order failed: ${sellOrderResult?.retMsg || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`❌ CRITICAL: Failed to create guaranteed take-profit order for ${filledBuyTrade.symbol}:`, error);
      
      await this.logActivity('order_failed', `CRITICAL: Guaranteed take-profit order failed for ${filledBuyTrade.symbol}`, {
        symbol: filledBuyTrade.symbol,
        error: error instanceof Error ? error.message : 'Unknown error',
        relatedBuyTradeId: filledBuyTrade.id,
        severity: 'CRITICAL'
      });
      
      throw error; // Re-throw to ensure this failure is handled upstream
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
