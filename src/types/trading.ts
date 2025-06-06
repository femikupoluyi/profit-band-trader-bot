
export interface ActiveTrade {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  side: string;
  status: string;
  created_at: string;
  profit_loss: number;
  currentPrice?: number;
  unrealizedPL?: number;
  volume?: number;
  buy_order_id?: string;
  sell_order_id?: string;
  buy_fill_price?: number;
  tp_price?: number;
  sell_status?: string;
}
