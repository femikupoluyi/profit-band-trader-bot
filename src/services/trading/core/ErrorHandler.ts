
import { TradingLogger } from './TradingLogger';
import { StandardizedError } from './TypeDefinitions';

export class ErrorHandler {
  private logger: TradingLogger;

  constructor(userId: string) {
    this.logger = new TradingLogger(userId);
  }

  async handleTradingError(operation: string, error: any, context?: any): Promise<StandardizedError> {
    const standardizedError: StandardizedError = {
      message: error instanceof Error ? error.message : String(error),
      code: error?.code || error?.retCode || 'UNKNOWN_ERROR',
      details: error,
      context: context || operation
    };

    console.error(`❌ Trading Error in ${operation}:`, standardizedError);

    try {
      await this.logger.logError(`Trading error in ${operation}`, error, context);
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return standardizedError;
  }

  async handleApiError(endpoint: string, error: any, requestData?: any): Promise<StandardizedError> {
    const standardizedError: StandardizedError = {
      message: `API Error at ${endpoint}: ${error instanceof Error ? error.message : String(error)}`,
      code: error?.response?.status || error?.code || 'API_ERROR',
      details: {
        endpoint,
        error,
        requestData
      },
      context: 'api_request'
    };

    console.error(`❌ API Error at ${endpoint}:`, standardizedError);

    try {
      await this.logger.logError(`API error at ${endpoint}`, error, { endpoint, requestData });
    } catch (logError) {
      console.error('Failed to log API error:', logError);
    }

    return standardizedError;
  }

  async handleDatabaseError(operation: string, error: any, query?: any): Promise<StandardizedError> {
    const standardizedError: StandardizedError = {
      message: `Database Error in ${operation}: ${error instanceof Error ? error.message : String(error)}`,
      code: error?.code || 'DATABASE_ERROR',
      details: {
        operation,
        error,
        query
      },
      context: 'database_operation'
    };

    console.error(`❌ Database Error in ${operation}:`, standardizedError);

    try {
      await this.logger.logError(`Database error in ${operation}`, error, { operation, query });
    } catch (logError) {
      console.error('Failed to log database error:', logError);
    }

    return standardizedError;
  }

  async handleValidationError(field: string, value: any, constraint: string): Promise<StandardizedError> {
    const standardizedError: StandardizedError = {
      message: `Validation Error: ${field} value '${value}' violates constraint '${constraint}'`,
      code: 'VALIDATION_ERROR',
      details: {
        field,
        value,
        constraint
      },
      context: 'validation'
    };

    console.error(`❌ Validation Error for ${field}:`, standardizedError);

    try {
      await this.logger.logError(`Validation error for ${field}`, new Error(standardizedError.message), { field, value, constraint });
    } catch (logError) {
      console.error('Failed to log validation error:', logError);
    }

    return standardizedError;
  }

  isRetryableError(error: StandardizedError): boolean {
    const retryableCodes = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'RATE_LIMIT',
      'SERVER_ERROR',
      500,
      502,
      503,
      504
    ];

    return retryableCodes.includes(error.code as any);
  }

  shouldStopTrading(error: StandardizedError): boolean {
    const criticalCodes = [
      'INSUFFICIENT_BALANCE',
      'INVALID_API_KEY',
      'API_KEY_EXPIRED',
      'UNAUTHORIZED',
      401,
      403
    ];

    return criticalCodes.includes(error.code as any);
  }
}
