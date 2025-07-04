import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from '../TradingLogger';
import { BybitApiValidator, ApiValidationResult } from './BybitApiValidator';
import { BybitErrorHandler } from './BybitErrorHandler';

/**
 * PHASE 3: Enhanced Bybit Client with validation, error handling, and retry logic
 */
export class EnhancedBybitClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private isDemoTrading: boolean;
  private logger: TradingLogger;
  private validator: BybitApiValidator;
  private errorHandler: BybitErrorHandler;

  constructor(
    apiKey: string, 
    apiSecret: string, 
    isDemoTrading: boolean = true, 
    apiUrl?: string,
    userId?: string
  ) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.isDemoTrading = isDemoTrading;
    
    if (apiUrl) {
      this.baseUrl = apiUrl;
    } else {
      this.baseUrl = isDemoTrading ? 'https://api-demo.bybit.com' : 'https://api.bybit.com';
    }

    this.logger = new TradingLogger(userId || 'system');
    this.validator = new BybitApiValidator(userId || 'system');
    this.errorHandler = new BybitErrorHandler(userId || 'system');

    console.log(`🔧 Enhanced BybitClient initialized with ${isDemoTrading ? 'DEMO' : 'MAINNET'} trading`);
  }

  /**
   * Enhanced place order with validation and retry logic
   */
  async placeOrder(params: any): Promise<any> {
    const context = `place_order_${params.symbol}`;
    
    console.log(`📝 [ENHANCED BYBIT] Placing order for ${params.symbol}...`);
    
    // Pre-validate order parameters
    const paramValidation = this.validator.validateOrderParams(params);
    if (!paramValidation.isValid) {
      const error = new Error(`Invalid order parameters: ${paramValidation.errors.join(', ')}`);
      await this.logger.logError('Order parameter validation failed', error, { params, validation: paramValidation });
      throw error;
    }

    return this.executeWithRetry(async () => {
      const response = await this.callBybitEdgeFunction({
        endpoint: '/v5/order/create',
        method: 'POST',
        params: params
      });

      const validation = this.validator.validateApiResponse(response, 'order');
      if (!validation.isValid) {
        const error = new Error(`Invalid API response: ${validation.errors.join(', ')}`);
        (error as any).response = response;
        throw error;
      }

      await this.logger.log('order_placed', `Enhanced order placed for ${params.symbol}`, {
        orderId: response.result?.orderId,
        params,
        validation
      });

      return response;
    }, context);
  }

  /**
   * Enhanced market price fetching with validation
   */
  async getMarketPrice(symbol: string): Promise<any> {
    const context = `get_market_price_${symbol}`;
    
    console.log(`📊 [ENHANCED BYBIT] Getting market price for ${symbol}...`);

    return this.executeWithRetry(async () => {
      const response = await this.callBybitEdgeFunction({
        endpoint: '/v5/market/tickers',
        method: 'GET',
        params: {
          category: 'spot',
          symbol: symbol
        }
      });

      const validation = this.validator.validateApiResponse(response, 'ticker');
      if (!validation.isValid) {
        const error = new Error(`Invalid ticker response: ${validation.errors.join(', ')}`);
        (error as any).response = response;
        throw error;
      }

      const ticker = response.result.list[0];
      const price = parseFloat(ticker.lastPrice);

      await this.logger.logSuccess(`Enhanced market price retrieved for ${symbol}`, {
        symbol,
        price,
        validation
      });

      return {
        symbol: ticker.symbol,
        price: price
      };
    }, context);
  }

  /**
   * Enhanced account balance with validation
   */
  async getAccountBalance(): Promise<any> {
    const context = 'get_account_balance';
    
    console.log('💰 [ENHANCED BYBIT] Getting account balance...');

    return this.executeWithRetry(async () => {
      const response = await this.callBybitEdgeFunction({
        endpoint: '/v5/account/wallet-balance',
        method: 'GET',
        params: {
          accountType: 'SPOT'
        }
      });

      const validation = this.validator.validateApiResponse(response, 'balance');
      if (!validation.isValid) {
        const error = new Error(`Invalid balance response: ${validation.errors.join(', ')}`);
        (error as any).response = response;
        throw error;
      }

      await this.logger.logSuccess('Enhanced account balance retrieved', { validation });
      return response;
    }, context);
  }

  /**
   * Execute API call with retry logic and error handling
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>, 
    context: string, 
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        console.log(`✅ [ENHANCED BYBIT] ${context} succeeded on attempt ${attempt}`);
        return result;
      } catch (error) {
        lastError = error;
        
        const errorResult = await this.errorHandler.handleError(error, context, attempt);
        
        if (errorResult.shouldRetry && attempt < maxRetries) {
          console.log(`⏳ [ENHANCED BYBIT] Retrying ${context} in ${errorResult.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, errorResult.retryDelay));
          continue;
        } else {
          throw errorResult.finalError || error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Call Bybit edge function with enhanced logging
   */
  private async callBybitEdgeFunction(request: any): Promise<any> {
    console.log(`🌐 [ENHANCED BYBIT] Calling edge function for ${request.endpoint}...`);
    
    const { data: apiResponse, error: apiError } = await supabase.functions.invoke('bybit-api', {
      body: {
        endpoint: request.endpoint,
        method: request.method,
        params: request.params,
        isDemoTrading: this.isDemoTrading,
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
        apiUrl: this.baseUrl
      }
    });
    
    if (apiError) {
      const error = new Error(`Bybit API Error: ${apiError.message}`);
      (error as any).apiError = apiError;
      throw error;
    }

    return apiResponse;
  }
}