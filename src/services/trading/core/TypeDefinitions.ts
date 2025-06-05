
// Core type definitions for the trading system

export type LogType = 
  | 'success'
  | 'error' 
  | 'system_info'
  | 'trade_executed'
  | 'signal_processed'
  | 'order_placed'
  | 'order_failed'
  | 'position_closed'
  | 'calculation_error'
  | 'execution_error'
  | 'signal_rejected'
  | 'trade_filled';

export interface StandardizedError {
  message: string;
  code?: string | number;
  details?: any;
  context: string;
}

export const VALID_CHART_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '6h', '12h', '1d'] as const;
export type ChartTimeframe = typeof VALID_CHART_TIMEFRAMES[number];

export const TRADING_ENVIRONMENT = {
  isDemoTrading: true, // Always use demo trading for safety
  baseUrl: 'https://api-demo.bybit.com'
} as const;

export interface TradingSignal {
  id: string;
  symbol: string;
  signal_type: string;
  price: number;
  confidence: number;
  reasoning?: string;
  processed: boolean;
  user_id: string;
  created_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: 'limit' | 'market';
  price: number;
  quantity: number;
  status: 'pending' | 'filled' | 'partial_filled' | 'closed' | 'cancelled';
  bybit_order_id?: string;
  profit_loss?: number;
  created_at: string;
  updated_at: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  timestamp: string;
  source: string;
  volume?: number;
}

export interface SupportLevel {
  price: number;
  strength: number;
  timestamp: number;
  touches: number;
}

export interface OrderParams {
  category: 'spot';
  symbol: string;
  side: 'Buy' | 'Sell';
  orderType: 'Limit' | 'Market';
  qty: string;
  price?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

export interface BybitApiResponse {
  retCode: number;
  retMsg: string;
  result?: any;
  time?: number;
}
