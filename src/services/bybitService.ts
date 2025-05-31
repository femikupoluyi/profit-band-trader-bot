
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

  private async createSignature(params: Record<string, any>, timestamp: number, recvWindow: number = 5000): Promise<string> {
    // Create the query string with all parameters
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

    // Create the signature string
    const signaturePayload = queryString + this.credentials.apiSecret;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(signaturePayload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async getAccountBalance(): Promise<any> {
    try {
      const timestamp = Date.now();
      const recvWindow = 5000;
      const params = {};
      
      const signature = await this.createSignature(params, timestamp, recvWindow);

      const response = await fetch(`${this.baseUrl}/v5/account/wallet-balance?accountType=UNIFIED`, {
        method: 'GET',
        headers: {
          'X-BAPI-API-KEY': this.credentials.apiKey,
          'X-BAPI-SIGN': signature,
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-RECV-WINDOW': recvWindow.toString(),
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
      const timestamp = Date.now();
      const recvWindow = 5000;
      
      const params = {
        category: 'spot',
        symbol: order.symbol,
        side: order.side,
        orderType: order.orderType,
        qty: order.qty,
        ...(order.price && { price: order.price }),
      };

      const signature = await this.createSignature(params, timestamp, recvWindow);

      console.log('Placing order with API key:', this.credentials.apiKey ? 'Present' : 'Missing');
      console.log('Order params:', params);

      const response = await fetch(`${this.baseUrl}/v5/order/create`, {
        method: 'POST',
        headers: {
          'X-BAPI-API-KEY': this.credentials.apiKey,
          'X-BAPI-SIGN': signature,
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-RECV-WINDOW': recvWindow.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const result = await response.json();
      console.log('Order response:', result);
      return result;
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    try {
      const timestamp = Date.now();
      const recvWindow = 5000;
      
      const params = {
        category: 'spot',
        orderId,
      };

      const signature = await this.createSignature(params, timestamp, recvWindow);

      const response = await fetch(
        `${this.baseUrl}/v5/order/realtime?category=spot&orderId=${orderId}`,
        {
          method: 'GET',
          headers: {
            'X-BAPI-API-KEY': this.credentials.apiKey,
            'X-BAPI-SIGN': signature,
            'X-BAPI-TIMESTAMP': timestamp.toString(),
            'X-BAPI-RECV-WINDOW': recvWindow.toString(),
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
