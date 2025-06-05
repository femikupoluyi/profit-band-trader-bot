
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';

export class ManualCloseService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.bybitService.setLogger(this.logger);
  }

  async closePosition(tradeId: string): Promise<void> {
    try {
      console.log(`🔄 MANUAL CLOSE SERVICE - Starting for trade ${tradeId}`);
      await this.logger.logSuccess(`[MANUAL CLOSE] Starting manual close for trade ${tradeId}`, { 
        tradeId,
        action: 'manual_close_service_start'
      });

      // Get the trade details with enhanced error handling
      console.log(`🔍 Fetching trade details for ${tradeId}...`);
      const { data: trade, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('user_id', this.userId)
        .maybeSingle();

      if (error) {
        const errorMsg = `Database error fetching trade ${tradeId}: ${error.message}`;
        console.error('❌ Database error:', error);
        await this.logger.logError(`[MANUAL CLOSE] ${errorMsg}`, error, { tradeId });
        throw new Error(errorMsg);
      }

      if (!trade) {
        const errorMsg = `Trade not found for manual close: ${tradeId}`;
        console.error('❌ Trade not found');
        await this.logger.logError(`[MANUAL CLOSE] ${errorMsg}`, new Error(errorMsg), { tradeId });
        throw new Error(errorMsg);
      }

      console.log(`📊 Trade found: ${trade.symbol}, Status: ${trade.status}, Entry: $${trade.price}, Qty: ${trade.quantity}`);
      await this.logger.logSuccess(`[MANUAL CLOSE] Trade found: ${trade.symbol} (${trade.status})`, {
        tradeId,
        symbol: trade.symbol,
        status: trade.status,
        entryPrice: trade.price,
        quantity: trade.quantity
      });

      if (trade.status !== 'filled') {
        const errorMsg = `Cannot close trade that is not filled. Status: ${trade.status}`;
        console.error('❌ Invalid trade status:', trade.status);
        await this.logger.log('order_rejected', `[MANUAL CLOSE] ${errorMsg}`, { 
          tradeId, 
          currentStatus: trade.status
        });
        throw new Error(errorMsg);
      }

      // Get current market price with enhanced error handling
      console.log(`📈 Getting current market price for ${trade.symbol}...`);
      await this.logger.logSuccess(`[MANUAL CLOSE] Fetching market price for ${trade.symbol}`, {
        tradeId,
        symbol: trade.symbol
      });

      let marketData;
      try {
        marketData = await this.bybitService.getMarketPrice(trade.symbol);
        console.log(`✅ Market data received:`, marketData);
        await this.logger.logSuccess(`[MANUAL CLOSE] Market price retrieved: $${marketData.price}`, {
          tradeId,
          symbol: trade.symbol,
          marketPrice: marketData.price
        });
      } catch (priceError) {
        const errorMsg = `Failed to get market price for ${trade.symbol}: ${priceError instanceof Error ? priceError.message : 'Unknown error'}`;
        console.error('❌ Market price error:', priceError);
        await this.logger.logError(`[MANUAL CLOSE] ${errorMsg}`, priceError, {
          tradeId,
          symbol: trade.symbol
        });
        throw new Error(errorMsg);
      }

      const currentPrice = marketData.price;
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());
      const profit = (currentPrice - entryPrice) * quantity;

      console.log(`💰 P&L calculation: Entry=$${entryPrice}, Current=$${currentPrice}, Qty=${quantity}, P&L=$${profit.toFixed(2)}`);
      await this.logger.logSuccess(`[MANUAL CLOSE] P&L calculated: $${profit.toFixed(2)}`, {
        tradeId,
        symbol: trade.symbol,
        entryPrice,
        currentPrice,
        quantity,
        profit,
        profitPercent: ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)
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
      await this.logger.logTradeAction('Placing market sell order', trade.symbol, {
        tradeId,
        orderParams: sellOrderParams,
        expectedProfit: profit
      });

      let sellResult;
      try {
        sellResult = await this.bybitService.placeOrder(sellOrderParams);
        console.log('✅ Bybit sell order response:', sellResult);
        await this.logger.logSuccess(`[MANUAL CLOSE] Bybit order response received`, {
          tradeId,
          symbol: trade.symbol,
          sellResult: {
            retCode: sellResult?.retCode,
            retMsg: sellResult?.retMsg,
            orderId: sellResult?.result?.orderId
          }
        });
      } catch (orderError) {
        const errorMsg = `Bybit order placement failed: ${orderError instanceof Error ? orderError.message : 'Unknown error'}`;
        console.error('❌ Bybit order error:', orderError);
        await this.logger.log('order_failed', `[MANUAL CLOSE] ${errorMsg}`, {
          tradeId,
          symbol: trade.symbol,
          error: orderError instanceof Error ? orderError.message : 'Unknown error',
          orderParams: sellOrderParams
        });
        throw new Error(errorMsg);
      }

      if (sellResult && sellResult.retCode === 0) {
        console.log(`✅ Market sell order placed successfully: ${sellResult.result?.orderId || 'No order ID'}`);
        await this.logger.log('order_placed', `[MANUAL CLOSE] Bybit order placed successfully`, {
          tradeId,
          symbol: trade.symbol,
          bybitOrderId: sellResult.result?.orderId
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
          await this.logger.logError(`[MANUAL CLOSE] Database update failed`, updateError, {
            tradeId,
            symbol: trade.symbol
          });
          throw updateError;
        }

        console.log(`✅ Manual close completed: ${trade.symbol} P&L: $${profit.toFixed(2)}`);
        await this.logger.log('position_closed', `[MANUAL CLOSE] Position closed successfully: ${trade.symbol}`, {
          tradeId,
          symbol: trade.symbol,
          entryPrice,
          exitPrice: currentPrice,
          profit,
          profitPercent: ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2),
          reason: 'manual_close_market_order',
          bybitOrderId: sellResult.result?.orderId || null
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
        await this.logger.log('order_failed', `[MANUAL CLOSE] ${errorMsg}`, {
          tradeId,
          symbol: trade.symbol,
          sellResult: sellResult,
          retCode: sellResult?.retCode,
          retMsg: sellResult?.retMsg
        });
        throw new Error(errorMsg);
      }

    } catch (error) {
      console.error(`❌ Error in manual close:`, error);
      await this.logger.logError(`[MANUAL CLOSE] Manual close failed for trade ${tradeId}`, error, {
        tradeId
      });
      throw error;
    }
  }
}
