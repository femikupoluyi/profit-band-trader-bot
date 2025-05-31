
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
      const { data: pendingTrades } = await (supabase as any)
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'pending');

      if (!pendingTrades || pendingTrades.length === 0) {
        console.log('No pending trades to monitor');
        return;
      }

      console.log(`Monitoring ${pendingTrades.length} pending trades...`);

      for (const trade of pendingTrades) {
        if (trade.bybit_order_id) {
          const orderStatus = await this.bybitService.getOrderStatus(trade.bybit_order_id);
          
          if (orderStatus.result && orderStatus.result.list && orderStatus.result.list.length > 0) {
            const order = orderStatus.result.list[0];
            const newStatus = this.mapOrderStatus(order.orderStatus);
            
            console.log(`Trade ${trade.id} status: ${order.orderStatus} -> ${newStatus}`);
            
            if (newStatus !== 'pending') {
              await (supabase as any)
                .from('trades')
                .update({
                  status: newStatus,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', trade.id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error monitoring positions:', error);
    }
  }

  private mapOrderStatus(bybitStatus: string): string {
    switch (bybitStatus) {
      case 'Filled':
        return 'filled';
      case 'Cancelled':
        return 'cancelled';
      case 'Rejected':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
