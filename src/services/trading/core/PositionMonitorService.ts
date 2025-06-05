import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class PositionMonitorService {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
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
        return;
      }

      if (!pendingTrades || pendingTrades.length === 0) {
        console.log('📭 No pending orders to check');
        return;
      }

      console.log(`📋 Found ${pendingTrades.length} pending orders to check`);

      for (const trade of pendingTrades) {
        await this.checkSingleOrderFill(trade);
      }

      console.log('✅ Order fill check completed');
    } catch (error) {
      console.error('❌ Error checking order fills:', error);
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
      
      if (orderStatus.orderStatus === 'Filled') {
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
        } else {
          console.log(`✅ Updated trade ${trade.id} status to filled`);
          await this.logActivity('order_filled', `Order filled for ${trade.symbol}`, {
            tradeId: trade.id,
            symbol: trade.symbol,
            bybitOrderId: trade.bybit_order_id
          });
        }
      } else {
        console.log(`⏳ Order ${trade.bybit_order_id} status: ${orderStatus.orderStatus}`);
      }

    } catch (error) {
      console.error(`❌ Error checking order ${trade.bybit_order_id}:`, error);
      await this.logActivity('system_error', `Failed to check order status`, {
        tradeId: trade.id,
        bybitOrderId: trade.bybit_order_id,
        error: error.message
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
