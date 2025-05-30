
interface BybitCredentials {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
}

interface OrderRequest {
  symbol: string;
  side: 'Buy' | 'Sell';
  orderType: 'Market' | 'Limit';
  qty: string;
  price?: string;
}

interface MarketPrice {
  symbol: string;
  price: number;
  timestamp: number;
}

export class BybitService {
  private credentials: BybitCredentials;
  private baseUrl: string;

  constructor(credentials: BybitCredentials) {
    this.credentials = credentials;
    this.baseUrl = credentials.testnet 
      ? 'https://api-testnet.bybit.com' 
      : 'https://api.bybit.com';
  }

  private async createSignature(params: Record<string, any>): Promise<string> {
    const timestamp = Date.now();
    const recvWindow = 5000;
    
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {} as Record<string, any>);

    const queryString = new URLSearchParams({
      ...sortedParams,
      api_key: this.credentials.apiKey,
      timestamp: timestamp.toString(),
      recv_window: recvWindow.toString(),
    }).toString();

    const encoder = new TextEncoder();
    const data = encoder.encode(queryString + this.credentials.apiSecret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async getAccountBalance(): Promise<any> {
    try {
      const params = {};
      const signature = await this.createSignature(params);
      const timestamp = Date.now();

      const response = await fetch(`${this.baseUrl}/v5/account/wallet-balance?accountType=UNIFIED`, {
        method: 'GET',
        headers: {
          'X-BAPI-API-KEY': this.credentials.apiKey,
          'X-BAPI-SIGN': signature,
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-RECV-WINDOW': '5000',
          'Content-Type': 'application/json',
        },
      });

      return await response.json();
    } catch (error) {
      console.error('Error fetching account balance:', error);
      throw error;
    }
  }

  async getMarketPrice(symbol: string): Promise<MarketPrice> {
    try {
      const response = await fetch(`${this.baseUrl}/v5/market/tickers?category=spot&symbol=${symbol}`);
      const data = await response.json();
      
      if (data.result && data.result.list && data.result.list.length > 0) {
        const ticker = data.result.list[0];
        return {
          symbol,
          price: parseFloat(ticker.lastPrice),
          timestamp: Date.now(),
        };
      }
      
      throw new Error(`No price data for ${symbol}`);
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      throw error;
    }
  }

  async placeOrder(order: OrderRequest): Promise<any> {
    try {
      const params = {
        category: 'spot',
        symbol: order.symbol,
        side: order.side,
        orderType: order.orderType,
        qty: order.qty,
        ...(order.price && { price: order.price }),
      };

      const signature = await this.createSignature(params);
      const timestamp = Date.now();

      const response = await fetch(`${this.baseUrl}/v5/order/create`, {
        method: 'POST',
        headers: {
          'X-BAPI-API-KEY': this.credentials.apiKey,
          'X-BAPI-SIGN': signature,
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-RECV-WINDOW': '5000',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      return await response.json();
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    try {
      const params = {
        category: 'spot',
        orderId,
      };

      const signature = await this.createSignature(params);
      const timestamp = Date.now();

      const response = await fetch(
        `${this.baseUrl}/v5/order/realtime?category=spot&orderId=${orderId}`,
        {
          method: 'GET',
          headers: {
            'X-BAPI-API-KEY': this.credentials.apiKey,
            'X-BAPI-SIGN': signature,
            'X-BAPI-TIMESTAMP': timestamp.toString(),
            'X-BAPI-RECV-WINDOW': '5000',
            'Content-Type': 'application/json',
          },
        }
      );

      return await response.json();
    } catch (error) {
      console.error('Error fetching order status:', error);
      throw error;
    }
  }
}
