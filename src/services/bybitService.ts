
import { buildGetRequest, buildPostRequest } from '../../supabase/functions/bybit-api/requestBuilder';
import { BybitRequest } from '../../supabase/functions/bybit-api/types';

export class BybitService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(apiKey: string, apiSecret: string, isDemoTrading: boolean = true) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    // Use Bybit demo trading URL by default
    this.baseUrl = isDemoTrading ? 'https://api-demo.bybit.com' : 'https://api.bybit.com';
    
    console.log(`🔧 BybitService initialized with ${isDemoTrading ? 'DEMO' : 'MAINNET'} trading URL: ${this.baseUrl}`);
    console.log(`🔑 API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : 'NOT SET'}`);
    console.log(`🔐 API Secret: ${apiSecret ? 'SET (' + apiSecret.length + ' chars)' : 'NOT SET'}`);
  }

  async getAccountBalance(): Promise<any> {
    try {
      console.log('💰 [BYBIT] Getting account balance...');
      const request = {
        endpoint: '/v5/account/wallet-balance',
        method: 'GET' as const,
        params: {
          accountType: 'SPOT'
        }
      };
      const result = await this.makeRequest(request);
      console.log('✅ [BYBIT] Account balance retrieved successfully');
      return result;
    } catch (error) {
      console.error('❌ [BYBIT] Error getting account balance:', error);
      throw error;
    }
  }

  async getMarketPrice(symbol: string): Promise<any> {
    try {
      console.log(`📊 [BYBIT] Getting market price for ${symbol}...`);
      const request = {
        endpoint: '/v5/market/tickers',
        method: 'GET' as const,
        params: {
          category: 'spot',
          symbol: symbol
        }
      };
      const response = await this.makeRequest(request);
      
      console.log(`📈 [BYBIT] Raw API response for ${symbol}:`, response);
      
      if (response.retCode === 0 && response.result?.list && response.result.list.length > 0) {
        const ticker = response.result.list[0];
        const price = parseFloat(ticker.lastPrice);
        
        console.log(`✅ [BYBIT] Market price for ${symbol}: $${price} (from lastPrice: ${ticker.lastPrice})`);
        
        // Validate that we got a valid price
        if (isNaN(price) || price <= 0) {
          console.error(`❌ [BYBIT] Invalid price received for ${symbol}: ${ticker.lastPrice} -> ${price}`);
          throw new Error(`Invalid price received for ${symbol}: ${price}`);
        }
        
        return {
          symbol: ticker.symbol,
          price: price
        };
      } else {
        console.error(`❌ [BYBIT] Failed to get market price for ${symbol}:`, response);
        throw new Error(`Failed to get market price for ${symbol}: ${response.retMsg || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`❌ [BYBIT] Error getting market price for ${symbol}:`, error);
      throw error;
    }
  }

  async placeOrder(params: any): Promise<any> {
    try {
      console.log(`📝 [BYBIT] Placing order for ${params.symbol}...`);
      console.log(`🔧 [BYBIT] Using ${this.baseUrl.includes('demo') ? 'DEMO' : 'MAINNET'} Trading URL: ${this.baseUrl}`);
      console.log(`📋 [BYBIT] Order params:`, params);
      
      const request = {
        endpoint: '/v5/order/create',
        method: 'POST' as const,
        params: params
      };
      
      const result = await this.makeRequest(request);
      
      if (result.retCode === 0) {
        console.log(`✅ [BYBIT] Order placed successfully for ${params.symbol}:`, result);
      } else {
        console.error(`❌ [BYBIT] Order failed for ${params.symbol}:`, result);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ [BYBIT] Error placing order for ${params.symbol}:`, error);
      throw error;
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    try {
      console.log(`🔍 [BYBIT] Getting order status for ${orderId}...`);
      const request = {
        endpoint: '/v5/order/history',
        method: 'GET' as const,
        params: {
          category: 'spot',
          orderId: orderId
        }
      };
      const result = await this.makeRequest(request);
      console.log(`✅ [BYBIT] Order status retrieved for ${orderId}:`, result);
      return result;
    } catch (error) {
      console.error(`❌ [BYBIT] Error getting order status for ${orderId}:`, error);
      throw error;
    }
  }

  private async makeRequest(request: BybitRequest): Promise<any> {
    try {
      console.log(`🌐 [BYBIT] Making API request to ${request.endpoint}...`);
      console.log(`📡 [BYBIT] Method: ${request.method}, Params:`, request.params);
      
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

      console.log(`🔗 [BYBIT] Request URL: ${url}`);
      if (body) console.log(`📦 [BYBIT] Request Body: ${body}`);

      const response = await fetch(url, {
        method: request.method,
        headers: headers,
        body: body
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`❌ [BYBIT] HTTP Error: ${response.status} ${response.statusText}`);
        console.error(`❌ [BYBIT] Response body:`, data);
        throw new Error(`Bybit API HTTP Error: ${response.status} - ${data.retMsg || response.statusText}`);
      }

      console.log(`✅ [BYBIT] API Response:`, data);
      
      if (data.retCode !== 0) {
        console.error(`❌ [BYBIT] API Error Code ${data.retCode}: ${data.retMsg}`);
        throw new Error(`Bybit API Error: ${data.retMsg} (Code: ${data.retCode})`);
      }

      return data;

    } catch (error) {
      console.error('❌ [BYBIT] Request error:', error);
      throw error;
    }
  }

  async getOrderHistory(limit: number = 50): Promise<any> {
    try {
      console.log(`📊 [BYBIT] Getting order history (limit: ${limit})...`);
      
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
        console.log(`✅ [BYBIT] Retrieved ${response.result?.list?.length || 0} order history records`);
      } else {
        console.error('❌ [BYBIT] Failed to get order history:', response);
      }

      return response;
    } catch (error) {
      console.error('❌ [BYBIT] Error getting order history:', error);
      throw error;
    }
  }
}
