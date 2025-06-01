
export interface TradingSignal {
  symbol: string;
  action: 'buy' | 'sell';
  price: number;
  confidence: number;
  reasoning: string;
  supportLevel?: number;
  takeProfitPrice?: number;
}

export interface ApiCredentials {
  api_key: string;
  api_secret: string;
  testnet: boolean;
  is_active: boolean;
}

export interface OrderRequest {
  category: string;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  qty: string;
  price?: string;
  timeInForce?: string;
}

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SupportLevel {
  price: number;
  strength: number;
  touchCount: number;
}
