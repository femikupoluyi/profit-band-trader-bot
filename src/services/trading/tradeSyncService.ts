
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';

export class TradeSyncService {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async syncTradeWithBybit(tradeId: string): Promise<boolean> {
    try {
      console.log(`🔄 Syncing trade ${tradeId} with Bybit...`);

      // Get local trade record
      const { data: trade, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (error || !trade) {
        console.error('Trade not found:', error);
        return false;
      }

      // Skip if no Bybit order ID
      if (!trade.bybit_order_id || trade.bybit_order_id.startsWith('mock_')) {
        console.log('No valid Bybit order ID, skipping sync');
        return false;
      }

      // Get order status from Bybit
      const bybitStatus = await this.bybitService.getOrderStatus(trade.bybit_order_id);
      
      if (bybitStatus.retCode !== 0) {
        console.error('Failed to get Bybit order status:', bybitStatus);
        return false;
      }

      const orderData = bybitStatus.result?.list?.[0];
      if (!orderData) {
        console.error('No order data from Bybit');
        return false;
      }

      console.log(`Bybit order status: ${orderData.orderStatus}`);

      // Map Bybit status to our status
      let newStatus = trade.status;
      let actualFillPrice = trade.price;
      let actualQuantity = trade.quantity;

      switch (orderData.orderStatus) {
        case 'Filled':
          newStatus = 'filled';
          actualFillPrice = parseFloat(orderData.avgPrice || orderData.price);
          actualQuantity = parseFloat(orderData.cumExecQty || orderData.qty);
          break;
        case 'PartiallyFilled':
          newStatus = 'partial_filled';
          actualFillPrice = parseFloat(orderData.avgPrice || orderData.price);
          actualQuantity = parseFloat(orderData.cumExecQty);
          break;
        case 'Cancelled':
        case 'Rejected':
          newStatus = 'cancelled';
          break;
        case 'New':
        case 'PartiallyFilledCanceled':
          newStatus = 'pending';
          break;
        default:
          console.log(`Unknown Bybit status: ${orderData.orderStatus}`);
          return false;
      }

      // Update local record if status changed
      if (newStatus !== trade.status || actualFillPrice !== trade.price || actualQuantity !== trade.quantity) {
        const { error: updateError } = await supabase
          .from('trades')
          .update({
            status: newStatus,
            price: actualFillPrice,
            quantity: actualQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', tradeId);

        if (updateError) {
          console.error('Failed to update trade status:', updateError);
          return false;
        }

        console.log(`✅ Trade ${tradeId} synced: ${trade.status} → ${newStatus}`);
        
        // Log the sync activity
        await this.logActivity('trade_synced', `Trade ${trade.symbol} synced with Bybit`, {
          tradeId,
          oldStatus: trade.status,
          newStatus,
          bybitOrderId: trade.bybit_order_id,
          actualFillPrice,
          actualQuantity
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error syncing trade ${tradeId}:`, error);
      return false;
    }
  }

  async syncAllActiveTrades(): Promise<void> {
    try {
      console.log('🔄 Syncing all active trades with Bybit...');

      const { data: activeTrades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'partial_filled'])
        .not('bybit_order_id', 'is', null)
        .not('bybit_order_id', 'like', 'mock_%');

      if (!activeTrades || activeTrades.length === 0) {
        console.log('No active trades to sync');
        return;
      }

      console.log(`Syncing ${activeTrades.length} active trades...`);

      for (const trade of activeTrades) {
        await this.syncTradeWithBybit(trade.id);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('✅ Completed syncing all active trades');
    } catch (error) {
      console.error('Error syncing active trades:', error);
    }
  }

  async verifyOrderPlacement(tradeId: string, maxRetries: number = 3): Promise<boolean> {
    try {
      console.log(`🔍 Verifying order placement for trade ${tradeId}...`);

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Verification attempt ${attempt}/${maxRetries}`);

        // Wait a bit for order to appear in Bybit system
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));

        const success = await this.syncTradeWithBybit(tradeId);
        if (success) {
          console.log(`✅ Order verification successful on attempt ${attempt}`);
          return true;
        }
      }

      console.error(`❌ Order verification failed after ${maxRetries} attempts`);
      
      // Mark trade as failed if verification fails
      await supabase
        .from('trades')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId);

      await this.logActivity('order_verification_failed', `Order verification failed for trade ${tradeId}`, {
        tradeId,
        maxRetries
      });

      return false;
    } catch (error) {
      console.error(`Error verifying order placement for trade ${tradeId}:`, error);
      return false;
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      const validLogTypes = [
        'signal_processed', 'trade_executed', 'trade_filled', 'position_closed',
        'system_error', 'order_placed', 'order_failed', 'calculation_error',
        'execution_error', 'signal_rejected', 'order_rejected', 'trade_synced'
      ];

      const validType = validLogTypes.includes(type) ? type : 'system_error';

      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: validType,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
