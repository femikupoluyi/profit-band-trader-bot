
export interface BybitRequest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, any>;
  body?: Record<string, any>;
  isDemoTrading?: boolean;
  apiKey?: string;  // Added for user credentials
  apiSecret?: string;  // Added for user credentials
}

export interface BybitResponse {
  retCode: number;
  retMsg: string;
  result?: any;
  time?: number;
}
