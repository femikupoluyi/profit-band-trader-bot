
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
    // Validate required credentials
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API credentials are required for authenticated requests');
    }

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

  private createErrorResponse(message: string): any {
    return { retCode: -1, retMsg: message, result: null };
  }

  async getAccountBalance(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v5/account/wallet-balance?accountType=SPOT`, {
        method: 'GET',
        headers: await this.getHeaders('GET', '/v5/account/wallet-balance', {accountType: 'SPOT'}),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting account balance:', error);
      return this.createErrorResponse(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    if (!orderId) {
      return this.createErrorResponse('Order ID is required');
    }

    try {
      const params = {
        category: 'spot',
        orderId: orderId,
      };
      const response = await fetch(`${this.baseUrl}/v5/order/history?${new URLSearchParams(params)}`, {
        method: 'GET',
        headers: await this.getHeaders('GET', '/v5/order/history', params),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting order status:', error);
      return this.createErrorResponse(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async placeOrder(params: any): Promise<any> {
    if (!params || !params.symbol || !params.side || !params.qty || !params.price) {
      return this.createErrorResponse('Missing required order parameters (symbol, side, qty, price)');
    }

    try {
      const response = await fetch(`${this.baseUrl}/v5/order/create`, {
        method: 'POST',
        headers: await this.getHeaders('POST', '/v5/order/create', params),
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error placing order:', error);
      return this.createErrorResponse(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cancelOrder(orderId: string, symbol: string): Promise<any> {
    if (!orderId || !symbol) {
      return this.createErrorResponse('Order ID and symbol are required');
    }

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
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error cancelling order:', error);
      return this.createErrorResponse(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Get open orders response:', data);
      return data;
    } catch (error) {
      console.error('Error getting open orders:', error);
      return this.createErrorResponse(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getOrderHistory(symbol?: string, limit: number = 50): Promise<any> {
    try {
      const params: any = {
        category: 'spot',
        limit: Math.min(Math.max(limit, 1), 100).toString() // Ensure limit is between 1-100
      };
      
      if (symbol) {
        params.symbol = symbol;
      }

      const response = await fetch(`${this.baseUrl}/v5/order/history`, {
        method: 'GET',
        headers: await this.getHeaders('GET', '/v5/order/history', params),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Get order history response:', data);
      return data;
    } catch (error) {
      console.error('Error getting order history:', error);
      return this.createErrorResponse(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Updated method to return object with price property
  async getMarketPrice(symbol: string): Promise<{ price: number } | null> {
    if (!symbol) {
      console.error('Symbol is required for market price');
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/v5/market/tickers?category=spot&symbol=${symbol}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.retCode === 0 && data.result?.list?.[0]?.lastPrice) {
        const price = parseFloat(data.result.list[0].lastPrice);
        if (isNaN(price) || price <= 0) {
          console.error('Invalid price received:', data.result.list[0].lastPrice);
          return null;
        }
        return { price };
      }
      return null;
    } catch (error) {
      console.error('Error getting market price:', error);
      return null;
    }
  }
}
