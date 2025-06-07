import crypto from 'crypto';

export class BybitService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private recvWindow: number;
  private logger?: any;

  constructor(apiKey?: string, apiSecret?: string, useTestnet: boolean = true) {
    // Set default empty credentials if not provided - they're not needed for public endpoints
    this.apiKey = apiKey || '';
    this.apiSecret = apiSecret || '';
    // Always use testnet for safety unless explicitly specified
    this.baseUrl = useTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
    this.recvWindow = 5000;
    
    console.log(`🔧 BybitService initialized with ${useTestnet ? 'TESTNET' : 'MAINNET'} URL: ${this.baseUrl}`);
  }

  // Add logger support for other services
  setLogger(logger: any) {
    this.logger = logger;
  }

  private async getHeaders(method: string, path: string, params: any = {}) {
    // For public endpoints (like market data), we don't need authentication
    if (!this.apiKey || !this.apiSecret) {
      return {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      };
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
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    };
  }

  private createErrorResponse(message: string): any {
    return { retCode: -1, retMsg: message, result: null };
  }

  async getAccountBalance(): Promise<any> {
    try {
      if (!this.apiKey || !this.apiSecret) {
        return this.createErrorResponse('API credentials required for account balance');
      }

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

    if (!this.apiKey || !this.apiSecret) {
      return this.createErrorResponse('API credentials required for order status');
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

    if (!this.apiKey || !this.apiSecret) {
      return this.createErrorResponse('API credentials required for placing orders');
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

    if (!this.apiKey || !this.apiSecret) {
      return this.createErrorResponse('API credentials required for cancelling orders');
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
    if (!this.apiKey || !this.apiSecret) {
      return this.createErrorResponse('API credentials required for open orders');
    }

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
    if (!this.apiKey || !this.apiSecret) {
      return this.createErrorResponse('API credentials required for order history');
    }

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

  // Updated method with enhanced error handling and public access
  async getMarketPrice(symbol: string): Promise<{ price: number } | null> {
    if (!symbol) {
      console.error('Symbol is required for market price');
      return null;
    }

    try {
      console.log(`🔄 Fetching market price for ${symbol} from ${this.baseUrl}...`);
      
      // Public endpoint - no authentication required
      const response = await fetch(`${this.baseUrl}/v5/market/tickers?category=spot&symbol=${symbol}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP ${response.status} for ${symbol}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`📊 Raw API response for ${symbol}:`, data);
      
      if (data.retCode === 0 && data.result?.list?.[0]?.lastPrice) {
        const price = parseFloat(data.result.list[0].lastPrice);
        if (isNaN(price) || price <= 0) {
          console.error(`Invalid price received for ${symbol}:`, data.result.list[0].lastPrice);
          return null;
        }
        console.log(`✅ Valid price for ${symbol}: $${price.toFixed(6)}`);
        return { price };
      } else if (data.retCode === 10001) {
        console.error(`❌ Symbol ${symbol} not supported on testnet:`, data.retMsg);
        return null;
      } else {
        console.error(`❌ API error for ${symbol}:`, data);
        return null;
      }
    } catch (error) {
      console.error(`❌ Network error getting market price for ${symbol}:`, error);
      if (this.logger) {
        await this.logger.logError(`Market price fetch failed for ${symbol}`, error, { symbol });
      }
      return null;
    }
  }
}
