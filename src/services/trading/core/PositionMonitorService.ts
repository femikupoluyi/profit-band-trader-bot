
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';

export class PositionMonitorService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.bybitService.setLogger(this.logger);
  }

  async checkOrderFills(config: TradingConfigData): Promise<void> {
    try {
      console.log('📊 Checking order fills...');
      
      // Get pending orders from database
      const { data: pendingTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'pending');

      if (error) {
        console.error('❌ Error fetching pending trades:', error);
        await this.logger.logError('Error fetching pending trades', error);
        return;
      }

      if (!pendingTrades || pendingTrades.length === 0) {
        console.log('📭 No pending orders to check');
        return;
      }

      console.log(`📋 Found ${pendingTrades.length} pending orders to check`);
      await this.logger.logSuccess(`Found ${pendingTrades.length} pending orders to check`);

      for (const trade of pendingTrades) {
        await this.checkSingleOrderFill(trade);
      }

      console.log('✅ Order fill check completed');
      await this.logger.logSuccess('Order fill check completed');
    } catch (error) {
      console.error('❌ Error checking order fills:', error);
      await this.logger.logError('Error checking order fills', error);
      throw error;
    }
  }

  private async checkSingleOrderFill(trade: any): Promise<void> {
    try {
      if (!trade.bybit_order_id) {
        console.log(`⚠️ Trade ${trade.id} has no Bybit order ID, skipping`);
        return;
      }

      console.log(`🔍 Checking order ${trade.bybit_order_id} for ${trade.symbol}`);

      // Get order status from Bybit - only pass the order ID
      const orderStatus = await this.bybitService.getOrderStatus(trade.bybit_order_id);
      
      // Check if the response has the expected structure
      if (orderStatus && orderStatus.retCode === 0 && orderStatus.result?.list?.length > 0) {
        const order = orderStatus.result.list[0];
        
        if (order.orderStatus === 'Filled') {
          console.log(`✅ Order ${trade.bybit_order_id} is filled`);
          
          // Update trade status in database
          const { error } = await supabase
            .from('trades')
            .update({ 
              status: 'filled',
              updated_at: new Date().toISOString()
            })
            .eq('id', trade.id);

          if (error) {
            console.error(`❌ Error updating trade ${trade.id}:`, error);
            await this.logger.logError(`Error updating trade ${trade.id}`, error, {
              tradeId: trade.id
            });
          } else {
            console.log(`✅ Updated trade ${trade.id} status to filled`);
            await this.logger.log('trade_filled', `Order filled for ${trade.symbol}`, {
              tradeId: trade.id,
              symbol: trade.symbol,
              bybitOrderId: trade.bybit_order_id
            });
          }
        } else {
          console.log(`⏳ Order ${trade.bybit_order_id} status: ${order.orderStatus}`);
        }
      } else {
        console.log(`⚠️ Invalid response for order ${trade.bybit_order_id}:`, orderStatus);
      }

    } catch (error) {
      console.error(`❌ Error checking order ${trade.bybit_order_id}:`, error);
      await this.logger.logError(`Failed to check order status`, error, {
        tradeId: trade.id,
        bybitOrderId: trade.bybit_order_id
      });
    }
  }
}
