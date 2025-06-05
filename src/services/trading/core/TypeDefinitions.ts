
export type TradeStatus = 'pending' | 'filled' | 'closed' | 'cancelled' | 'rejected';
export type TradeSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type SignalType = 'buy' | 'sell' | 'hold' | 'support_break' | 'resistance_break';

export type LogType = 
  | 'signal_processed'
  | 'trade_executed' 
  | 'trade_filled'
  | 'position_closed'
  | 'system_error'
  | 'order_placed'
  | 'order_failed'
  | 'calculation_error'
  | 'execution_error'
  | 'signal_rejected'
  | 'order_rejected'
  | 'info'
  | 'error' 
  | 'success'
  | 'system_info';

export interface StandardizedError {
  message: string;
  code?: string | number;
  details?: any;
  context: string;
}

export interface TradingEnvironment {
  isDemoTrading: true; // Always demo trading
  baseUrl: 'https://api-demo.bybit.com';
  wsUrl: 'wss://stream-demo.bybit.com';
}

export const TRADING_ENVIRONMENT: TradingEnvironment = {
  isDemoTrading: true,
  baseUrl: 'https://api-demo.bybit.com',
  wsUrl: 'wss://stream-demo.bybit.com'
};

export const VALID_CHART_TIMEFRAMES = [
  '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'
] as const;

export type ChartTimeframe = typeof VALID_CHART_TIMEFRAMES[number];

// Add missing interfaces for better type safety
export interface TradeRecord {
  id: string;
  user_id: string;
  symbol: string;
  side: TradeSide;
  order_type: OrderType;
  quantity: number;
  price: number;
  status: TradeStatus;
  bybit_order_id?: string;
  profit_loss?: number;
  created_at: string;
  updated_at: string;
}

export interface TradingSignal {
  id: string;
  user_id: string;
  symbol: string;
  signal_type: SignalType;
  price: number;
  confidence?: number;
  reasoning?: string;
  processed: boolean;
  created_at: string;
}

export interface ApiCredentials {
  id: string;
  user_id: string;
  exchange_name: string;
  api_key: string;
  api_secret: string;
  testnet: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
