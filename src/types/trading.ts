
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
  fillPrice?: number; // Actual fill price from exchange
  buy_fill_price?: number; // Database column name
}
