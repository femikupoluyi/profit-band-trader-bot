
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

  async closePosition(tradeId: string): Promise<void> {
    try {
      console.log(`🔄 Manual close requested for trade ${tradeId}`);
      
      // Get trade details
      const { data: trade, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('user_id', this.userId)
        .single();

      if (error || !trade) {
        throw new Error(`Trade ${tradeId} not found`);
      }

      if (trade.status !== 'filled') {
        throw new Error(`Cannot close trade ${tradeId}: status is ${trade.status}`);
      }

      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;

      // Format quantity and price for Bybit
      const formattedQuantity = await ConfigurableFormatter.formatQuantity(trade.symbol, parseFloat(trade.quantity.toString()));
      const formattedPrice = await ConfigurableFormatter.formatPrice(trade.symbol, currentPrice);

      // Place market sell order to close position
      const sellOrderParams = {
        category: 'spot' as const,
        symbol: trade.symbol,
        side: 'Sell' as const,
        orderType: 'Market' as const,
        qty: formattedQuantity
      };

      console.log('📝 Placing manual close order:', sellOrderParams);
      const orderResult = await this.bybitService.placeOrder(sellOrderParams);

      if (orderResult && orderResult.retCode === 0) {
        // Calculate P&L
        const entryPrice = parseFloat(trade.price.toString());
        const quantity = parseFloat(trade.quantity.toString());
        const profitLoss = (currentPrice - entryPrice) * quantity;

        // Update trade status
        await supabase
          .from('trades')
          .update({
            status: 'closed',
            profit_loss: profitLoss,
            updated_at: new Date().toISOString()
          })
          .eq('id', tradeId);

        await this.logger.log('position_closed', `Manual close executed for ${trade.symbol}`, {
          tradeId,
          symbol: trade.symbol,
          closePrice: currentPrice,
          profitLoss,
          bybitOrderId: orderResult.result?.orderId
        });

        console.log(`✅ Manual close completed for ${trade.symbol}: P&L = $${profitLoss.toFixed(2)}`);
      } else {
        throw new Error(`Bybit order failed: ${orderResult?.retMsg || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`❌ Error in manual close for trade ${tradeId}:`, error);
      await this.logger.logError(`Manual close failed for trade ${tradeId}`, error);
      throw error;
    }
  }
}
