
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { OrderPlacer } from './OrderPlacer';

export class PositionMonitorService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private orderPlacer: OrderPlacer;
  private isMonitoring: boolean = false;

  constructor(userId: string, bybitService: BybitService, logger?: TradingLogger) {
    if (!userId) {
      throw new Error('UserId is required for PositionMonitorService');
    }
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = logger || new TradingLogger(userId);
    this.orderPlacer = new OrderPlacer(userId, bybitService, this.logger);
  }

  async monitorOrderFills(): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ Order fill monitoring already in progress, skipping...');
      return;
    }

    this.isMonitoring = true;
    try {
      console.log('🔍 Monitoring order fills...');

      // Get pending orders that need monitoring
      const { data: pendingTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'pending')
        .not('bybit_order_id', 'is', null);

      if (error) {
        await this.logger.logError('Failed to fetch pending trades', error);
        return;
      }

      if (!pendingTrades || pendingTrades.length === 0) {
        console.log('📭 No pending trades to monitor');
        return;
      }

      console.log(`👀 Monitoring ${pendingTrades.length} pending trades`);

      for (const trade of pendingTrades) {
        try {
          await this.checkOrderStatus(trade);
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          await this.logger.logError(`Error checking trade ${trade.id}`, error, {
            tradeId: trade.id,
            symbol: trade.symbol
          });
        }
      }

    } catch (error) {
      await this.logger.logError('Position monitor exception', error);
    } finally {
      this.isMonitoring = false;
    }
  }

  async checkOrderFills(): Promise<void> {
    return this.monitorOrderFills();
  }

  async auditMissingTakeProfitOrders(configData?: any): Promise<void> {
    console.log('🔍 Auditing missing take profit orders...');
    
    try {
      // Get filled buy orders without take profit orders
      const { data: filledBuys, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('side', 'buy')
        .eq('status', 'filled')
        .is('sell_order_id', null);

      if (error) {
        await this.logger.logError('Failed to fetch filled buy orders for TP audit', error);
        return;
      }

      if (!filledBuys || filledBuys.length === 0) {
        console.log('✅ No filled buy orders missing take profit orders');
        return;
      }

      console.log(`🔍 Found ${filledBuys.length} filled buy orders without take profit orders`);

      for (const trade of filledBuys) {
        try {
          // Try to find existing TP order on Bybit
          await this.orderPlacer.findAndLinkTPOrder(trade.id, trade.symbol);
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          await this.logger.logError(`Failed to audit TP for trade ${trade.id}`, error, {
            tradeId: trade.id,
            symbol: trade.symbol
          });
        }
      }

      console.log('✅ Take profit audit completed');
      
    } catch (error) {
      await this.logger.logError('Take profit audit failed', error);
    }
  }

  private async checkOrderStatus(trade: any): Promise<void> {
    if (!trade || !trade.bybit_order_id) {
      console.log('⚠️ Invalid trade data or missing bybit_order_id');
      return;
    }

    try {
      console.log(`🔄 Checking status for trade ${trade.id} (${trade.symbol})`);

      // Get order status from Bybit
      const orderStatus = await this.bybitService.getOrderStatus(trade.bybit_order_id);
      
      if (orderStatus.retCode !== 0) {
        console.log(`⚠️ Failed to get order status for ${trade.bybit_order_id}: ${orderStatus.retMsg}`);
        return;
      }

      const orderData = orderStatus.result?.list?.[0];
      if (!orderData) {
        console.log(`📭 No order data found for ${trade.bybit_order_id}`);
        return;
      }

      console.log(`📊 Order ${trade.bybit_order_id} status: ${orderData.orderStatus}`);

      // Handle filled orders
      if (orderData.orderStatus === 'Filled' && trade.status !== 'filled') {
        await this.handleOrderFill(trade, orderData);
      }
      // Handle cancelled orders
      else if (['Cancelled', 'Rejected'].includes(orderData.orderStatus) && trade.status !== 'cancelled') {
        await this.handleOrderCancellation(trade, orderData);
      }

    } catch (error) {
      await this.logger.logError(`Order status check failed for trade ${trade.id}`, error, {
        tradeId: trade.id,
        bybitOrderId: trade.bybit_order_id
      });
    }
  }

  private async handleOrderFill(trade: any, orderData: any): Promise<void> {
    try {
      const fillPrice = parseFloat(orderData.avgPrice || orderData.price || trade.price);
      const fillQuantity = parseFloat(orderData.cumExecQty || orderData.qty || trade.quantity);

      if (isNaN(fillPrice) || isNaN(fillQuantity) || fillPrice <= 0 || fillQuantity <= 0) {
        await this.logger.logError('Invalid fill data received', new Error('Invalid price or quantity'), {
          tradeId: trade.id,
          fillPrice,
          fillQuantity,
          orderData
        });
        return;
      }

      console.log(`✅ Order filled: ${trade.symbol} ${trade.side} at ${fillPrice}`);

      const updateData: any = {
        status: 'filled',
        price: fillPrice,
        quantity: fillQuantity,
        updated_at: new Date().toISOString()
      };

      // For buy orders, store the fill price and look for auto-generated TP order
      if (trade.side === 'buy') {
        updateData.buy_fill_price = fillPrice;
        updateData.buy_order_id = trade.bybit_order_id;
      }

      // Update trade status
      const { error } = await supabase
        .from('trades')
        .update(updateData)
        .eq('id', trade.id);

      if (error) {
        await this.logger.logError('Failed to update filled trade', error, { tradeId: trade.id });
        return;
      }

      console.log(`📝 Updated trade ${trade.id} status to filled`);

      // For buy orders with TP, try to find and link the auto-generated sell order
      if (trade.side === 'buy' && trade.tp_price) {
        console.log(`🔍 Looking for auto-generated TP order for ${trade.symbol}`);
        // Wait a moment for Bybit to create the TP order
        setTimeout(async () => {
          try {
            await this.orderPlacer.findAndLinkTPOrder(trade.id, trade.symbol);
          } catch (error) {
            await this.logger.logError(`Failed to find TP order for trade ${trade.id}`, error);
          }
        }, 2000);
      }

      await this.logger.logSuccess(`Order filled: ${trade.side} ${trade.symbol} at ${fillPrice}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        fillPrice,
        fillQuantity,
        hasTP: !!trade.tp_price
      });

    } catch (error) {
      await this.logger.logError(`Handle order fill failed for trade ${trade.id}`, error);
    }
  }

  private async handleOrderCancellation(trade: any, orderData: any): Promise<void> {
    try {
      console.log(`❌ Order cancelled: ${trade.symbol} ${trade.side}`);

      const { error } = await supabase
        .from('trades')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id);

      if (error) {
        await this.logger.logError('Failed to update cancelled trade', error, { tradeId: trade.id });
        return;
      }

      await this.logger.logSuccess(`Order cancelled: ${trade.side} ${trade.symbol}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        reason: orderData.orderStatus
      });

    } catch (error) {
      await this.logger.logError(`Handle order cancellation failed for trade ${trade.id}`, error);
    }
  }
}
