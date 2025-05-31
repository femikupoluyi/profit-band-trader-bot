
export interface TradingSignal {
  symbol: string;
  action: 'buy' | 'sell';
  price: number;
  confidence: number;
  reasoning: string;
}

export interface ApiCredentials {
  api_key: string;
  api_secret: string;
  testnet: boolean;
  is_active: boolean;
}

export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  qty: string;
  price?: string;
}
