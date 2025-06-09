
export interface BybitRequest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, any>;
  body?: Record<string, any>;
  isDemoTrading?: boolean;
  apiKey?: string;
  apiSecret?: string;
  apiUrl?: string;
}

export interface BybitResponse {
  retCode: number;
  retMsg: string;
  result?: any;
  time?: number;
}
