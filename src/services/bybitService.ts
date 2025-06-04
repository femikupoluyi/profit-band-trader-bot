
import { buildGetRequest, buildPostRequest } from '../../supabase/functions/bybit-api/requestBuilder';
import { BybitRequest } from '../../supabase/functions/bybit-api/types';

export class BybitService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(apiKey: string, apiSecret: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
  }

  async getAccountBalance(): Promise<any> {
    try {
      console.log('💰 Getting account balance from Bybit...');
      const request = {
        endpoint: '/v5/account/wallet-balance',
        method: 'GET' as const,
        params: {
          accountType: 'SPOT'
        }
      };
      return await this.makeRequest(request);
    } catch (error) {
      console.error('Error getting account balance:', error);
      throw error;
    }
  }

  async getMarketPrice(symbol: string): Promise<any> {
    try {
      console.log(`📊 Getting market price for ${symbol} from Bybit...`);
      const request = {
        endpoint: '/v5/market/tickers',
        method: 'GET' as const,
        params: {
          category: 'spot',
          symbol: symbol
        }
      };
      const response = await this.makeRequest(request);
      
      console.log(`Raw API response for ${symbol}:`, response);
      
      if (response.retCode === 0 && response.result?.list && response.result.list.length > 0) {
        const ticker = response.result.list[0];
        const price = parseFloat(ticker.lastPrice);
        
        console.log(`✅ Market price for ${symbol}: $${price} (from lastPrice: ${ticker.lastPrice})`);
        
        // Validate that we got a valid price
        if (isNaN(price) || price <= 0) {
          console.error(`❌ Invalid price received for ${symbol}: ${ticker.lastPrice} -> ${price}`);
          throw new Error(`Invalid price received for ${symbol}: ${price}`);
        }
        
        return {
          symbol: ticker.symbol,
          price: price
        };
      } else {
        console.error(`❌ Failed to get market price for ${symbol}:`, response);
        throw new Error(`Failed to get market price for ${symbol}: ${response.retMsg || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`❌ Error getting market price for ${symbol}:`, error);
      throw error;
    }
  }

  async placeOrder(params: any): Promise<any> {
    try {
      console.log(`📝 Placing order on Bybit for ${params.symbol}...`);
      const request = {
        endpoint: '/v5/order/create',
        method: 'POST' as const,
        params: params
      };
      return await this.makeRequest(request);
    } catch (error) {
      console.error(`Error placing order for ${params.symbol}:`, error);
      throw error;
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    try {
      console.log(`🔍 Getting order status for ${orderId} from Bybit...`);
      const request = {
        endpoint: '/v5/order/history',
        method: 'GET' as const,
        params: {
          category: 'spot',
          orderId: orderId
        }
      };
      return await this.makeRequest(request);
    } catch (error) {
      console.error(`Error getting order status for ${orderId}:`, error);
      throw error;
    }
  }

  private async makeRequest(request: BybitRequest): Promise<any> {
    try {
      console.log(`🌐 Making Bybit API request to ${request.endpoint}...`);
      let url: string, headers: Record<string, string>, body: string | undefined = undefined;

      if (request.method === 'GET') {
        const getRequest = await buildGetRequest(request, this.apiKey, this.apiSecret, this.baseUrl);
        url = getRequest.url;
        headers = getRequest.headers;
      } else {
        const postRequest = await buildPostRequest(request, this.apiKey, this.apiSecret, this.baseUrl);
        url = postRequest.url;
        headers = postRequest.headers;
        body = postRequest.body;
      }

      console.log(`  ${request.method} ${url}`);
      if (body) console.log(`  Body: ${body}`);

      const response = await fetch(url, {
        method: request.method,
        headers: headers,
        body: body
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`  Request failed: ${response.status} ${response.statusText}`);
        console.error('  Response body:', data);
        throw new Error(`Bybit API Error: ${data.retMsg} (Code: ${data.retCode})`);
      }

      console.log('  Response:', data);
      return data;

    } catch (error) {
      console.error('  Request error:', error);
      throw error;
    }
  }

  async getOrderHistory(limit: number = 50): Promise<any> {
    try {
      console.log(`📊 Getting order history from Bybit (limit: ${limit})...`);
      
      const request = {
        endpoint: '/v5/order/history',
        method: 'GET' as const,
        params: {
          category: 'spot',
          limit: limit.toString(),
          orderStatus: 'Filled'
        }
      };

      const response = await this.makeRequest(request);
      
      if (response.retCode === 0) {
        console.log(`✅ Retrieved ${response.result?.list?.length || 0} order history records`);
      } else {
        console.error('Failed to get order history:', response);
      }

      return response;
    } catch (error) {
      console.error('Error getting order history:', error);
      throw error;
    }
  }
}
