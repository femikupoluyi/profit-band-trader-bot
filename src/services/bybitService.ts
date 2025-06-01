
interface BybitCredentials {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
}

interface OrderRequest {
  category: string;
  symbol: string;
  side: 'Buy' | 'Sell';
  orderType: 'Market' | 'Limit';
  qty: string;
  price?: string;
  timeInForce?: string;
}

interface MarketPrice {
  symbol: string;
  price: number;
  timestamp: number;
}

export class BybitService {
  private credentials: BybitCredentials;
  private baseUrl: string;
  private isBrowserEnvironment: boolean;

  constructor(credentials: BybitCredentials) {
    this.credentials = credentials;
    // Force main API even if testnet flag is true
    this.baseUrl = 'https://api.bybit.com';
    this.isBrowserEnvironment = typeof window !== 'undefined';
    
    console.log('BybitService initialized:', {
      mainnetTrading: true,
      apiKey: credentials.apiKey ? `${credentials.apiKey.substring(0, 8)}...` : 'Missing',
      isBrowser: this.isBrowserEnvironment,
      baseUrl: this.baseUrl
    });
  }

  private async callBybitAPI(endpoint: string, method: string = 'GET', params: Record<string, any> = {}): Promise<any> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      console.log(`🚀 Making FRESH API call to Bybit MAIN exchange: ${method} ${endpoint}`, params);
      
      // Add timestamp and random value to prevent any caching
      const timestamp = Date.now();
      const randomValue = Math.random().toString(36).substring(7);
      const requestParams = {
        ...params,
        _t: timestamp,
        _cache_bust: randomValue // Additional anti-cache parameter
      };
      
      const { data, error } = await supabase.functions.invoke('bybit-api', {
        body: {
          endpoint,
          method,
          params: requestParams,
          isDemoTrading: false, // Force main exchange
          timestamp,
          cacheBust: randomValue
        }
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(`Bybit API call failed: ${error.message}`);
      }

      console.log('✅ Fresh API response received from Bybit MAIN exchange:', data);
      return data;
    } catch (error) {
      console.error('❌ Bybit API call error:', error);
      throw error;
    }
  }

  async getAccountBalance(): Promise<any> {
    try {
      console.log('Fetching account balance from Bybit MAIN exchange...');
      return await this.callBybitAPI('/v5/account/wallet-balance', 'GET', {
        accountType: 'UNIFIED'
      });
    } catch (error) {
      console.error('Error fetching balance from main exchange:', error);
      throw error; // Don't use fallback for main exchange
    }
  }

  async getMarketPrice(symbol: string): Promise<MarketPrice> {
    try {
      console.log(`🔄 Fetching REAL-TIME price for ${symbol} from Bybit MAIN exchange (NO CACHE)...`);
      
      // Force fresh API call with multiple anti-cache parameters
      const response = await this.callBybitAPI('/v5/market/tickers', 'GET', {
        category: 'spot',
        symbol,
        _nocache: Date.now(),
        _fresh: Math.random(),
        _live: true
      });

      if (response.retCode === 0 && response.result?.list?.[0]) {
        const ticker = response.result.list[0];
        const price = parseFloat(ticker.lastPrice);
        
        console.log(`✅ FRESH market price for ${symbol}: $${price.toFixed(6)} (from Bybit MAIN exchange)`);
        return {
          symbol,
          price,
          timestamp: Date.now(),
        };
      }

      console.error(`❌ Invalid response from Bybit MAIN exchange for ${symbol}:`, response);
      throw new Error(`Invalid response from Bybit for ${symbol}: ${response.retMsg || 'Unknown error'}`);
    } catch (error) {
      console.error(`❌ Error fetching real-time price for ${symbol} from MAIN exchange:`, error);
      throw new Error(`Failed to fetch real-time price for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async placeOrder(order: OrderRequest): Promise<any> {
    try {
      console.log('Placing order on Bybit MAIN exchange:', order);
      
      if (!order.symbol || !order.side || !order.orderType || !order.qty) {
        throw new Error('Missing required order parameters');
      }

      if (order.orderType === 'Limit' && !order.price) {
        throw new Error('Price is required for limit orders');
      }

      // Clean parameters - remove undefined values
      const orderParams: Record<string, any> = {
        category: order.category,
        symbol: order.symbol,
        side: order.side,
        orderType: order.orderType,
        qty: order.qty,
      };

      // Only add optional parameters if they exist
      if (order.orderType === 'Limit' && order.price) {
        orderParams.price = order.price;
      }
      
      if (order.timeInForce) {
        orderParams.timeInForce = order.timeInForce;
      } else {
        orderParams.timeInForce = order.orderType === 'Market' ? 'IOC' : 'GTC';
      }

      console.log('Final order parameters for MAIN exchange:', orderParams);

      const response = await this.callBybitAPI('/v5/order/create', 'POST', orderParams);
      
      console.log('Order response from MAIN exchange:', response);
      return response;
    } catch (error) {
      console.error('Error placing order on main exchange:', error);
      throw error;
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    try {
      console.log('Fetching order status from MAIN exchange:', orderId);
      
      return await this.callBybitAPI('/v5/order/realtime', 'GET', {
        category: 'spot',
        orderId
      });
    } catch (error) {
      console.error('Error fetching order status from main exchange:', error);
      throw error;
    }
  }
}
