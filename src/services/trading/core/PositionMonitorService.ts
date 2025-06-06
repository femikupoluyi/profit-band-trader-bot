
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';
import { OrderPlacer } from './OrderPlacer';

export class PositionMonitorService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private orderPlacer: OrderPlacer;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.bybitService.setLogger(this.logger);
    this.orderPlacer = new OrderPlacer(userId, bybitService);
  }

  async checkOrderFills(config: TradingConfigData): Promise<void> {
    try {
      console.log('📊 Checking order fills and linking auto-generated TP orders...');
      
      // Get pending buy orders from database
      const { data: pendingBuyTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('side', 'buy')
        .eq('status', 'pending');

      if (error) {
        console.error('❌ Error fetching pending buy trades:', error);
        await this.logger.logError('Error fetching pending buy trades', error);
        return;
      }

      if (!pendingBuyTrades || pendingBuyTrades.length === 0) {
        console.log('📭 No pending buy orders to check');
        return;
      }

      console.log(`📋 Found ${pendingBuyTrades.length} pending buy orders to check for fills`);
      await this.logger.logSuccess(`Found ${pendingBuyTrades.length} pending buy orders to check`);

      for (const trade of pendingBuyTrades) {
        await this.checkSingleOrderFill(trade, config);
      }

      console.log('✅ Order fill check completed with auto-TP linking');
      await this.logger.logSuccess('Order fill check completed');
    } catch (error) {
      console.error('❌ Error checking order fills:', error);
      await this.logger.logError('Error checking order fills', error);
      throw error;
    }
  }

  private async checkSingleOrderFill(trade: any, config: TradingConfigData): Promise<void> {
    try {
      if (!trade.buy_order_id) {
        console.log(`⚠️ Trade ${trade.id} has no buy order ID, skipping`);
        return;
      }

      console.log(`🔍 Checking buy order ${trade.buy_order_id} for ${trade.symbol}`);

      // Get order status from Bybit
      const orderStatus = await this.bybitService.getOrderStatus(trade.buy_order_id);
      
      if (orderStatus && orderStatus.retCode === 0 && orderStatus.result?.list?.length > 0) {
        const order = orderStatus.result.list[0];
        
        if (order.orderStatus === 'Filled') {
          console.log(`✅ Buy order ${trade.buy_order_id} is filled - finding auto-generated TP order`);
          
          // Update trade status to filled with actual fill price
          const actualFillPrice = parseFloat(order.avgPrice || order.price);
          
          const { error: updateError } = await supabase
            .from('trades')
            .update({ 
              status: 'filled',
              buy_fill_price: actualFillPrice,
              updated_at: new Date().toISOString()
            })
            .eq('id', trade.id);

          if (updateError) {
            console.error(`❌ Error updating trade ${trade.id}:`, updateError);
            await this.logger.logError(`Error updating trade ${trade.id}`, updateError, {
              tradeId: trade.id
            });
            return;
          }

          console.log(`✅ Updated trade ${trade.id} status to filled with fill price ${actualFillPrice}`);
          await this.logger.log('trade_filled', `Buy order filled for ${trade.symbol}`, {
            tradeId: trade.id,
            symbol: trade.symbol,
            buyOrderId: trade.buy_order_id,
            fillPrice: actualFillPrice,
            quantity: trade.quantity
          });

          // Find and link the auto-generated TP sell order
          const updatedTrade = { ...trade, buy_fill_price: actualFillPrice };
          await this.orderPlacer.findAndLinkTakeProfitOrder(updatedTrade);
          
        } else {
          console.log(`⏳ Buy order ${trade.buy_order_id} status: ${order.orderStatus}`);
        }
      } else {
        console.log(`⚠️ Invalid response for order ${trade.buy_order_id}:`, orderStatus);
      }

    } catch (error) {
      console.error(`❌ Error checking buy order ${trade.buy_order_id}:`, error);
      await this.logger.logError(`Failed to check buy order status`, error, {
        tradeId: trade.id,
        buyOrderId: trade.buy_order_id
      });
      throw error;
    }
  }

  // Method to audit filled buys and ensure they have linked TP orders
  async auditMissingTakeProfitOrders(config: TradingConfigData): Promise<void> {
    try {
      console.log('🔍 Auditing filled buy orders for missing TP order links...');
      
      // Get all filled buy orders without sell_order_id
      const { data: filledBuys, error: filledError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('side', 'buy')
        .eq('status', 'filled')
        .is('sell_order_id', null);

      if (filledError) {
        console.error('❌ Error fetching filled buy orders:', filledError);
        return;
      }

      if (!filledBuys || filledBuys.length === 0) {
        console.log('📭 No filled buy orders missing TP links found');
        return;
      }

      console.log(`📋 Found ${filledBuys.length} filled buy orders missing TP links`);

      for (const buyTrade of filledBuys) {
        console.log(`🔍 Searching for TP order for filled buy ${buyTrade.symbol}`);
        await this.orderPlacer.findAndLinkTakeProfitOrder(buyTrade);
      }

      console.log('✅ TP order audit completed');
    } catch (error) {
      console.error('❌ Error during TP order audit:', error);
      await this.logger.logError('TP order audit failed', error);
    }
  }
}
