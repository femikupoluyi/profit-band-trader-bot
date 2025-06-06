
import crypto from 'crypto';

export class BybitService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private recvWindow: number;
  private logger?: any;

  constructor(apiKey?: string, apiSecret?: string, useTestnet?: boolean) {
    // Require explicit API credentials - no fallback to potentially undefined env vars
    this.apiKey = apiKey || '';
    this.apiSecret = apiSecret || '';
    this.baseUrl = useTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
    this.recvWindow = 5000;
  }

  // Add logger support for other services
  setLogger(logger: any) {
    this.logger = logger;
  }

  private async getHeaders(method: string, path: string, params: any = {}) {
    const timestamp = Date.now().toString();
    const queryString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    let sign = '';
    if (method === 'GET') {
      sign = crypto
        .createHmac('sha256', this.apiSecret)
        .update(timestamp + this.apiKey + this.recvWindow + queryString)
        .digest('hex');
    } else {
      sign = crypto
        .createHmac('sha256', this.apiSecret)
        .update(timestamp + this.apiKey + this.recvWindow + JSON.stringify(params))
        .digest('hex');
    }

    return {
      'Content-Type': 'application/json',
      'X-BAPI-API-KEY': this.apiKey,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': this.recvWindow.toString(),
      'X-BAPI-SIGN': sign,
    };
  }

  async getAccountBalance(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v5/account/wallet-balance?accountType=SPOT`, {
        method: 'GET',
        headers: await this.getHeaders('GET', '/v5/account/wallet-balance', {accountType: 'SPOT'}),
      });
      return await response.json();
    } catch (error) {
      console.error('Error getting account balance:', error);
      return { retCode: -1, retMsg: 'Network error', result: null };
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    try {
      const params = {
        category: 'spot',
        orderId: orderId,
      };
      const response = await fetch(`${this.baseUrl}/v5/order/history?${new URLSearchParams(params)}`, {
        method: 'GET',
        headers: await this.getHeaders('GET', '/v5/order/history', params),
      });
      return await response.json();
    } catch (error) {
      console.error('Error getting order status:', error);
      return { retCode: -1, retMsg: 'Network error', result: null };
    }
  }

  async placeOrder(params: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v5/order/create`, {
        method: 'POST',
        headers: await this.getHeaders('POST', '/v5/order/create', params),
        body: JSON.stringify(params),
      });
      return await response.json();
    } catch (error) {
      console.error('Error placing order:', error);
      return { retCode: -1, retMsg: 'Network error', result: null };
    }
  }

  async cancelOrder(orderId: string, symbol: string): Promise<any> {
    try {
      const params = {
        category: 'spot',
        symbol: symbol,
        orderId: orderId,
      };
      const response = await fetch(`${this.baseUrl}/v5/order/cancel`, {
        method: 'POST',
        headers: await this.getHeaders('POST', '/v5/order/cancel', params),
        body: JSON.stringify(params),
      });
      return await response.json();
    } catch (error) {
      console.error('Error cancelling order:', error);
      return { retCode: -1, retMsg: 'Network error', result: null };
    }
  }

  async getOpenOrders(symbol?: string): Promise<any> {
    try {
      const params: any = {
        category: 'spot'
      };
      
      if (symbol) {
        params.symbol = symbol;
      }

      const response = await fetch(`${this.baseUrl}/v5/order/realtime`, {
        method: 'GET',
        headers: await this.getHeaders('GET', '/v5/order/realtime', params),
      });

      const data = await response.json();
      console.log('Get open orders response:', data);
      return data;
    } catch (error) {
      console.error('Error getting open orders:', error);
      return { retCode: -1, retMsg: 'Network error', result: null };
    }
  }

  async getOrderHistory(symbol?: string, limit: number = 50): Promise<any> {
    try {
      const params: any = {
        category: 'spot',
        limit: limit.toString()
      };
      
      if (symbol) {
        params.symbol = symbol;
      }

      const response = await fetch(`${this.baseUrl}/v5/order/history`, {
        method: 'GET',
        headers: await this.getHeaders('GET', '/v5/order/history', params),
      });

      const data = await response.json();
      console.log('Get order history response:', data);
      return data;
    } catch (error) {
      console.error('Error getting order history:', error);
      return { retCode: -1, retMsg: 'Network error', result: null };
    }
  }

  // Updated method to return object with price property
  async getMarketPrice(symbol: string): Promise<{ price: number } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v5/market/tickers?category=spot&symbol=${symbol}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      if (data.retCode === 0 && data.result?.list?.[0]?.lastPrice) {
        return { price: parseFloat(data.result.list[0].lastPrice) };
      }
      return null;
    } catch (error) {
      console.error('Error getting market price:', error);
      return null;
    }
  }
}
