
export interface BybitRequest {
  endpoint: string;
  method?: string;
  params?: Record<string, any>;
  isDemoTrading?: boolean;
  timestamp?: number;
  cacheBust?: string;
}

export interface SignatureParams {
  apiKey: string;
  apiSecret: string;
  timestamp: string;
  recvWindow: string;
  params: Record<string, any>;
  requestBody?: string;
}
