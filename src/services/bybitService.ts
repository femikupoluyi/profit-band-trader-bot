import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './trading/core/TradingLogger';

export class BybitService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private logger: TradingLogger | null = null;
  private isDemoTrading: boolean;

  constructor(apiKey: string, apiSecret: string, isDemoTrading: boolean = true) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.isDemoTrading = isDemoTrading;
    this.baseUrl = isDemoTrading ? 'https://api-demo.bybit.com' : 'https://api.bybit.com';
    
    console.log(`🔧 BybitService initialized with ${isDemoTrading ? 'DEMO' : 'MAINNET'} trading URL: ${this.baseUrl}`);
    console.log(`🔑 API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : 'NOT SET'}`);
    console.log(`🔐 API Secret: ${apiSecret ? 'SET (' + apiSecret.length + ' chars)' : 'NOT SET'}`);
  }

  setLogger(logger: TradingLogger): void {
    this.logger = logger;
  }

  async getAccountBalance(): Promise<any> {
    try {
      console.log('💰 [BYBIT] Getting account balance...');
      await this.logger?.logSuccess('[BYBIT] Getting account balance');
      
      const result = await this.callBybitEdgeFunction({
        endpoint: '/v5/account/wallet-balance',
        method: 'GET',
        params: {
          accountType: 'SPOT'
        }
      });

      console.log('✅ [BYBIT] Account balance retrieved successfully');
      await this.logger?.logSuccess('[BYBIT] Account balance retrieved successfully');
      return result;
    } catch (error) {
      console.error('❌ [BYBIT] Error getting account balance:', error);
      await this.logger?.logError('[BYBIT] Error getting account balance', error);
      throw error;
    }
  }

  async getMarketPrice(symbol: string): Promise<any> {
    try {
      console.log(`📊 [BYBIT] Getting market price for ${symbol}...`);
      await this.logger?.logSuccess(`[BYBIT] Getting market price for ${symbol}`);
      
      const response = await this.callBybitEdgeFunction({
        endpoint: '/v5/market/tickers',
        method: 'GET',
        params: {
          category: 'spot',
          symbol: symbol
        }
      });
      
      console.log(`📈 [BYBIT] Raw API response for ${symbol}:`, response);
      
      if (response.retCode === 0 && response.result?.list && response.result.list.length > 0) {
        const ticker = response.result.list[0];
        const price = parseFloat(ticker.lastPrice);
        
        console.log(`✅ [BYBIT] Market price for ${symbol}: $${price}`);
        await this.logger?.logSuccess(`[BYBIT] Market price for ${symbol}: $${price}`, { symbol, price });
        
        if (isNaN(price) || price <= 0) {
          const errorMsg = `Invalid price received for ${symbol}: ${ticker.lastPrice}`;
          console.error(`❌ [BYBIT] ${errorMsg}`);
          await this.logger?.logError(`[BYBIT] ${errorMsg}`, new Error(errorMsg));
          throw new Error(errorMsg);
        }
        
        return {
          symbol: ticker.symbol,
          price: price
        };
      } else {
        const errorMsg = `Failed to get market price for ${symbol}: ${response.retMsg || 'Unknown error'}`;
        console.error(`❌ [BYBIT] ${errorMsg}`, response);
        await this.logger?.logError(`[BYBIT] ${errorMsg}`, new Error(errorMsg), { response });
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error(`❌ [BYBIT] Error getting market price for ${symbol}:`, error);
      await this.logger?.logError(`[BYBIT] Error getting market price for ${symbol}`, error);
      throw error;
    }
  }

  async getOpenOrders(params: {
    category?: string;
    symbol?: string;
    limit?: number;
  } = {}): Promise<any> {
    try {
      console.log(`📊 [BYBIT] Getting open orders...`);
      await this.logger?.logSuccess('[BYBIT] Getting open orders');
      
      const queryParams = {
        category: params.category || 'spot',
        limit: (params.limit || 50).toString(),
        ...params
      };

      const response = await this.callBybitEdgeFunction({
        endpoint: '/v5/order/realtime',
        method: 'GET',
        params: queryParams
      });
      
      if (response.retCode === 0) {
        console.log(`✅ [BYBIT] Retrieved ${response.result?.list?.length || 0} open orders`);
      } else {
        console.error('❌ [BYBIT] Failed to get open orders:', response);
      }

      return response;
    } catch (error) {
      console.error('❌ [BYBIT] Error getting open orders:', error);
      await this.logger?.logError('[BYBIT] Error getting open orders', error);
      throw error;
    }
  }

  async placeOrder(params: any): Promise<any> {
    try {
      console.log(`📝 [BYBIT] Placing order for ${params.symbol}...`);
      console.log(`🔧 [BYBIT] Using ${this.baseUrl.includes('demo') ? 'DEMO' : 'MAINNET'} Trading URL: ${this.baseUrl}`);
      console.log(`📋 [BYBIT] Order params:`, params);
      
      await this.logger?.logTradeAction('Placing order', params.symbol, { 
        orderParams: params,
        tradingMode: this.baseUrl.includes('demo') ? 'DEMO' : 'MAINNET'
      });
      
      const result = await this.callBybitEdgeFunction({
        endpoint: '/v5/order/create',
        method: 'POST',
        params: params
      });
      
      if (result.retCode === 0) {
        console.log(`✅ [BYBIT] Order placed successfully for ${params.symbol}:`, result);
        await this.logger?.log('order_placed', `[BYBIT] Order placed successfully for ${params.symbol}`, { 
          result,
          orderId: result.result?.orderId 
        });
      } else {
        console.error(`❌ [BYBIT] Order failed for ${params.symbol}:`, result);
        await this.logger?.log('order_failed', `[BYBIT] Order failed for ${params.symbol}`, { result });
      }
      
      return result;
    } catch (error) {
      console.error(`❌ [BYBIT] Error placing order for ${params.symbol}:`, error);
      await this.logger?.logError(`[BYBIT] Error placing order for ${params.symbol}`, error);
      throw error;
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    try {
      console.log(`🔍 [BYBIT] Getting order status for ${orderId}...`);
      
      const result = await this.callBybitEdgeFunction({
        endpoint: '/v5/order/history',
        method: 'GET',
        params: {
          category: 'spot',
          orderId: orderId
        }
      });

      console.log(`✅ [BYBIT] Order status retrieved for ${orderId}:`, result);
      return result;
    } catch (error) {
      console.error(`❌ [BYBIT] Error getting order status for ${orderId}:`, error);
      throw error;
    }
  }

  async getOrderHistory(limit: number = 50): Promise<any> {
    try {
      console.log(`📊 [BYBIT] Getting order history (limit: ${limit})...`);
      
      const response = await this.callBybitEdgeFunction({
        endpoint: '/v5/order/history',
        method: 'GET',
        params: {
          category: 'spot',
          limit: limit.toString(),
          orderStatus: 'Filled'
        }
      });
      
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

  async getExecutionHistory(params: {
    category?: string;
    symbol?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  } = {}): Promise<any> {
    try {
      console.log(`📊 [BYBIT] Getting execution history...`);
      
      const queryParams = {
        category: params.category || 'spot',
        limit: (params.limit || 50).toString(),
        ...params
      };

      const response = await this.callBybitEdgeFunction({
        endpoint: '/v5/execution/list',
        method: 'GET',
        params: queryParams
      });
      
      if (response.retCode === 0) {
        console.log(`✅ [BYBIT] Retrieved ${response.result?.list?.length || 0} execution records`);
      } else {
        console.error('❌ [BYBIT] Failed to get execution history:', response);
      }

      return response;
    } catch (error) {
      console.error('❌ [BYBIT] Error getting execution history:', error);
      throw error;
    }
  }

  private async callBybitEdgeFunction(request: any): Promise<any> {
    try {
      console.log(`🌐 [BYBIT] Calling edge function for ${request.endpoint}...`);
      console.log(`📡 [BYBIT] Method: ${request.method}, Params:`, request.params);
      
      const { data: apiResponse, error: apiError } = await supabase.functions.invoke('bybit-api', {
        body: {
          endpoint: request.endpoint,
          method: request.method,
          params: request.params,
          isDemoTrading: this.isDemoTrading
        }
      });
      
      if (apiError) {
        console.error(`❌ [BYBIT] Edge function error:`, apiError);
        await this.logger?.logError(`[BYBIT] Edge function error`, apiError);
        throw new Error(`Bybit API Error: ${apiError.message}`);
      }

      console.log(`✅ [BYBIT] Edge function response:`, apiResponse);
      return apiResponse;

    } catch (error) {
      console.error('❌ [BYBIT] Edge function call error:', error);
      await this.logger?.logError('[BYBIT] Edge function call error', error);
      throw error;
    }
  }
}
