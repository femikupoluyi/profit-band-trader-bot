
import { TradingLogger } from './TradingLogger';

export interface ErrorContext {
  userId?: string;
  symbol?: string;
  operation?: string;
  attempt?: number;
  error?: string;
  data?: any;
}

export class ErrorHandler {
  private logger: TradingLogger;

  constructor(userId: string) {
    this.logger = new TradingLogger(userId);
  }

  async handleError(error: any, context: ErrorContext = {}): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`❌ [ErrorHandler] ${context.operation || 'Operation'} failed:`, {
      message: errorMessage,
      context,
      stack: errorStack
    });

    // Log to database
    await this.logger.logError(
      `${context.operation || 'Operation'} failed`,
      error,
      context
    );
  }

  async handleWarning(message: string, context: ErrorContext = {}): Promise<void> {
    console.warn(`⚠️ [ErrorHandler] ${message}:`, context);

    await this.logger.logSuccess(`Warning: ${message}`, context);
  }

  createError(message: string, context: ErrorContext = {}): Error {
    const error = new Error(message);
    
    // Add context to error object for debugging
    (error as any).context = context;
    
    return error;
  }

  isRetryableError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Network errors that can be retried
      if (message.includes('timeout') || 
          message.includes('network') || 
          message.includes('connection') ||
          message.includes('econnreset') ||
          message.includes('enotfound')) {
        return true;
      }

      // API rate limiting
      if (message.includes('rate limit') || 
          message.includes('too many requests')) {
        return true;
      }
    }

    return false;
  }

  async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    context: ErrorContext = {}
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!this.isRetryableError(error) || attempt === maxRetries) {
          await this.handleError(error, { ...context, attempt });
          throw error;
        }

        await this.handleWarning(
          `Attempt ${attempt} failed, retrying in ${delay}ms`,
          { ...context, attempt, error: error.message }
        );

        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }

    throw lastError;
  }
}
