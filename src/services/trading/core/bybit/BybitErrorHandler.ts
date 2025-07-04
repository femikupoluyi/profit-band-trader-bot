import { TradingLogger } from '../TradingLogger';
import { BybitApiValidator } from './BybitApiValidator';

export interface ErrorHandlingResult {
  shouldRetry: boolean;
  retryDelay: number;
  finalError?: Error;
}

/**
 * PHASE 3: Centralized Bybit Error Handling
 */
export class BybitErrorHandler {
  private logger: TradingLogger;
  private validator: BybitApiValidator;
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY = 1000;

  constructor(userId: string) {
    this.logger = new TradingLogger(userId);
    this.validator = new BybitApiValidator(userId);
  }

  /**
   * Handle and categorize Bybit API errors
   */
  async handleError(error: any, context: string, attemptNumber: number = 1): Promise<ErrorHandlingResult> {
    const result: ErrorHandlingResult = {
      shouldRetry: false,
      retryDelay: 0
    };

    console.log(`❌ [BYBIT ERROR] ${context} - Attempt ${attemptNumber}:`, error);

    // Log the error with context
    await this.logger.logError(`Bybit API error in ${context}`, error, {
      attemptNumber,
      errorType: this.categorizeError(error),
      retCode: error.retCode,
      retMsg: error.retMsg
    });

    // Determine if retry is appropriate
    if (attemptNumber < this.MAX_RETRIES && this.validator.isRetriableError(error)) {
      result.shouldRetry = true;
      result.retryDelay = this.calculateRetryDelay(attemptNumber, error);
      
      console.log(`🔄 [BYBIT RETRY] Will retry ${context} in ${result.retryDelay}ms (attempt ${attemptNumber + 1}/${this.MAX_RETRIES})`);
    } else {
      result.finalError = this.createFinalError(error, context, attemptNumber);
      console.log(`🚫 [BYBIT FINAL] Not retrying ${context} after ${attemptNumber} attempts`);
    }

    return result;
  }

  /**
   * Categorize error types for better handling
   */
  private categorizeError(error: any): string {
    if (!error) return 'unknown';

    const message = error.message?.toLowerCase() || '';
    const retCode = error.retCode;

    // Network errors
    if (message.includes('timeout') || 
        message.includes('network') || 
        message.includes('connection') ||
        message.includes('fetch')) {
      return 'network';
    }

    // Rate limiting
    if (message.includes('rate limit') || 
        message.includes('too many requests') ||
        retCode === 10006) {
      return 'rate_limit';
    }

    // Authentication errors
    if (retCode === 10003 || retCode === 10004 || retCode === 10005) {
      return 'authentication';
    }

    // Invalid parameters
    if (retCode >= 10017 && retCode <= 10024) {
      return 'invalid_params';
    }

    // Server errors
    if (retCode >= 10001 && retCode <= 10020) {
      return 'server_error';
    }

    // Insufficient balance
    if (retCode === 170213) {
      return 'insufficient_balance';
    }

    return 'unknown';
  }

  /**
   * Calculate appropriate retry delay based on error type and attempt
   */
  private calculateRetryDelay(attemptNumber: number, error: any): number {
    const errorType = this.categorizeError(error);
    let baseDelay = this.BASE_DELAY;

    // Adjust base delay by error type
    switch (errorType) {
      case 'rate_limit':
        baseDelay = 5000; // 5 seconds for rate limits
        break;
      case 'network':
        baseDelay = 2000; // 2 seconds for network issues
        break;
      case 'server_error':
        baseDelay = 3000; // 3 seconds for server errors
        break;
      default:
        baseDelay = 1000; // 1 second default
    }

    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attemptNumber - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    return Math.round(exponentialDelay + jitter);
  }

  /**
   * Create a descriptive final error when all retries are exhausted
   */
  private createFinalError(originalError: any, context: string, attemptNumber: number): Error {
    const errorType = this.categorizeError(originalError);
    const retCode = originalError.retCode;
    const retMsg = originalError.retMsg;

    let message = `Bybit API failed for ${context} after ${attemptNumber} attempts. `;
    
    switch (errorType) {
      case 'authentication':
        message += 'Authentication failed. Please check your API credentials.';
        break;
      case 'rate_limit':
        message += 'Rate limit exceeded. Please reduce request frequency.';
        break;
      case 'insufficient_balance':
        message += 'Insufficient balance to execute the order.';
        break;
      case 'invalid_params':
        message += 'Invalid parameters provided to the API.';
        break;
      case 'network':
        message += 'Network connectivity issues. Please check your connection.';
        break;
      case 'server_error':
        message += 'Bybit server error. Please try again later.';
        break;
      default:
        message += `Unknown error occurred.`;
    }

    if (retCode) {
      message += ` (Code: ${retCode})`;
    }
    
    if (retMsg) {
      message += ` - ${retMsg}`;
    }

    const finalError = new Error(message);
    finalError.name = `BybitApiError_${errorType}`;
    (finalError as any).originalError = originalError;
    (finalError as any).retCode = retCode;
    (finalError as any).errorType = errorType;

    return finalError;
  }
}