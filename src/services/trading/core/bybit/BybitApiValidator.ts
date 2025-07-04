import { TradingLogger } from '../TradingLogger';

export interface ApiValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BybitResponse {
  retCode: number;
  retMsg: string;
  result?: any;
}

/**
 * PHASE 3: Bybit API Response Validation and Error Handling
 */
export class BybitApiValidator {
  private logger: TradingLogger;

  constructor(userId: string) {
    this.logger = new TradingLogger(userId);
  }

  /**
   * Validate Bybit API response structure and content
   */
  validateApiResponse(response: any, expectedType: 'ticker' | 'balance' | 'order' | 'history'): ApiValidationResult {
    const result: ApiValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Basic response structure validation
    if (!response) {
      result.errors.push('Response is null or undefined');
      result.isValid = false;
      return result;
    }

    if (typeof response.retCode !== 'number') {
      result.errors.push('Missing or invalid retCode in response');
      result.isValid = false;
    }

    if (response.retCode !== 0) {
      result.errors.push(`API error: ${response.retMsg || 'Unknown error'} (Code: ${response.retCode})`);
      result.isValid = false;
    }

    // Type-specific validations
    switch (expectedType) {
      case 'ticker':
        this.validateTickerResponse(response, result);
        break;
      case 'balance':
        this.validateBalanceResponse(response, result);
        break;
      case 'order':
        this.validateOrderResponse(response, result);
        break;
      case 'history':
        this.validateHistoryResponse(response, result);
        break;
    }

    return result;
  }

  /**
   * Validate order parameters before sending to API
   */
  validateOrderParams(params: any): ApiValidationResult {
    const result: ApiValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const requiredFields = ['symbol', 'side', 'orderType', 'qty'];
    for (const field of requiredFields) {
      if (!params[field]) {
        result.errors.push(`Missing required field: ${field}`);
        result.isValid = false;
      }
    }

    // Validate numeric fields
    if (params.qty && (isNaN(parseFloat(params.qty)) || parseFloat(params.qty) <= 0)) {
      result.errors.push('Invalid quantity: must be a positive number');
      result.isValid = false;
    }

    if (params.price && (isNaN(parseFloat(params.price)) || parseFloat(params.price) <= 0)) {
      result.errors.push('Invalid price: must be a positive number');
      result.isValid = false;
    }

    // Validate side
    if (params.side && !['Buy', 'Sell'].includes(params.side)) {
      result.errors.push('Invalid side: must be "Buy" or "Sell"');
      result.isValid = false;
    }

    // Validate order type
    if (params.orderType && !['Market', 'Limit'].includes(params.orderType)) {
      result.errors.push('Invalid orderType: must be "Market" or "Limit"');
      result.isValid = false;
    }

    return result;
  }

  private validateTickerResponse(response: any, result: ApiValidationResult): void {
    if (!response.result?.list || !Array.isArray(response.result.list)) {
      result.errors.push('Invalid ticker response: missing or invalid result.list');
      result.isValid = false;
      return;
    }

    if (response.result.list.length === 0) {
      result.warnings.push('Ticker response contains no data');
      return;
    }

    const ticker = response.result.list[0];
    if (!ticker.symbol) {
      result.errors.push('Ticker missing symbol');
      result.isValid = false;
    }

    if (!ticker.lastPrice || isNaN(parseFloat(ticker.lastPrice))) {
      result.errors.push('Ticker missing or invalid lastPrice');
      result.isValid = false;
    }
  }

  private validateBalanceResponse(response: any, result: ApiValidationResult): void {
    if (!response.result?.list || !Array.isArray(response.result.list)) {
      result.errors.push('Invalid balance response: missing or invalid result.list');
      result.isValid = false;
      return;
    }

    // Additional balance-specific validations can be added here
  }

  private validateOrderResponse(response: any, result: ApiValidationResult): void {
    if (!response.result) {
      result.errors.push('Invalid order response: missing result');
      result.isValid = false;
      return;
    }

    if (!response.result.orderId) {
      result.errors.push('Order response missing orderId');
      result.isValid = false;
    }
  }

  private validateHistoryResponse(response: any, result: ApiValidationResult): void {
    if (!response.result?.list || !Array.isArray(response.result.list)) {
      result.errors.push('Invalid history response: missing or invalid result.list');
      result.isValid = false;
      return;
    }

    // Additional history-specific validations can be added here
  }

  /**
   * Check if an error is retriable
   */
  isRetriableError(error: any): boolean {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';
    const retCode = error.retCode;

    // Network-related errors
    if (message.includes('timeout') || 
        message.includes('network') || 
        message.includes('connection') ||
        message.includes('fetch')) {
      return true;
    }

    // Rate limiting
    if (message.includes('rate limit') || 
        message.includes('too many requests') ||
        retCode === 10006) {
      return true;
    }

    // Temporary server errors
    if (retCode >= 10001 && retCode <= 10020) {
      return true;
    }

    return false;
  }
}