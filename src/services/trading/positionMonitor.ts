
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';

export class PositionMonitor {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async monitorPositions(): Promise<void> {
    try {
      const { data: pendingTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching pending trades:', error);
        return;
      }

      if (!pendingTrades || pendingTrades.length === 0) {
        console.log('No pending trades to monitor');
        return;
      }

      console.log(`Monitoring ${pendingTrades.length} pending trades...`);

      for (const trade of pendingTrades) {
        if (trade.bybit_order_id) {
          try {
            const orderStatus = await this.bybitService.getOrderStatus(trade.bybit_order_id);
            
            if (orderStatus.result && orderStatus.result.list && orderStatus.result.list.length > 0) {
              const order = orderStatus.result.list[0];
              const newStatus = this.mapOrderStatus(order.orderStatus);
              
              console.log(`Trade ${trade.id} status: ${order.orderStatus} -> ${newStatus}`);
              
              if (newStatus !== 'pending') {
                const updateData = {
                  status: newStatus,
                  updated_at: new Date().toISOString(),
                };

                const { error: updateError } = await supabase
                  .from('trades')
                  .update(updateData)
                  .eq('id', trade.id);

                if (updateError) {
                  console.error(`Error updating trade ${trade.id}:`, updateError);
                } else {
                  console.log(`Trade ${trade.id} status updated to ${newStatus}`);
                }
              }
            }
          } catch (error) {
            console.error(`Error monitoring trade ${trade.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error monitoring positions:', error);
    }
  }

  private mapOrderStatus(bybitStatus: string): string {
    // Map Bybit order statuses to our database statuses
    // Ensure these match the check constraint in the database
    switch (bybitStatus) {
      case 'Filled':
        return 'filled';
      case 'Cancelled':
        return 'cancelled';
      case 'Rejected':
        return 'cancelled'; // Map rejected to cancelled for consistency
      case 'PartiallyFilled':
        return 'pending'; // Keep as pending until fully filled
      default:
        return 'pending';
    }
  }
}
