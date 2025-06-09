
import { supabase } from '@/integrations/supabase/client';

export interface TradeRecordData {
  userId: string;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market';
  price: number;
  quantity: number;
  status: string;
  bybitOrderId: string;
}

export class TradeRecorder {
  static async createTradeRecord(data: TradeRecordData): Promise<any> {
    const { data: trade, error } = await supabase
      .from('trades')
      .insert({
        user_id: data.userId,
        symbol: data.symbol,
        side: data.side,
        order_type: data.orderType,
        price: data.price,
        quantity: data.quantity,
        status: data.status,
        bybit_order_id: data.bybitOrderId,
      })
      .select()
      .single();

    if (error) throw error;
    return trade;
  }

  static async logActivity(userId: string, type: string, message: string, data?: any): Promise<void> {
    try {
      await supabase
        .from('trading_logs')
        .insert({
          user_id: userId,
          log_type: type,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
