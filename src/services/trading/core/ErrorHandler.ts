
export class TradingError extends Error {
  public readonly code: string;
  public readonly context?: any;

  constructor(message: string, code: string, context?: any) {
    super(message);
    this.name = 'TradingError';
    this.code = code;
    this.context = context;
  }
}

export class ErrorHandler {
  static handleOrderError(error: any, symbol: string, operation: string): TradingError {
    const context = { symbol, operation };
    
    if (error instanceof TradingError) {
      return error;
    }
    
    if (error?.message?.includes('insufficient balance')) {
      return new TradingError(
        `Insufficient balance for ${operation} order on ${symbol}`,
        'INSUFFICIENT_BALANCE',
        context
      );
    }
    
    if (error?.message?.includes('minimum order')) {
      return new TradingError(
        `Order does not meet minimum requirements for ${symbol}`,
        'MIN_ORDER_NOT_MET',
        context
      );
    }
    
    if (error?.message?.includes('network') || error?.message?.includes('timeout')) {
      return new TradingError(
        `Network error during ${operation} for ${symbol}`,
        'NETWORK_ERROR',
        context
      );
    }
    
    return new TradingError(
      `Unknown error during ${operation} for ${symbol}: ${error?.message || 'Unknown error'}`,
      'UNKNOWN_ERROR',
      { ...context, originalError: error }
    );
  }

  static handleValidationError(error: any, field: string, value: any): TradingError {
    return new TradingError(
      `Validation failed for ${field}: ${error?.message || 'Invalid value'}`,
      'VALIDATION_ERROR',
      { field, value, originalError: error }
    );
  }

  static handleDatabaseError(error: any, operation: string, table?: string): TradingError {
    const context = { operation, table };
    
    if (error?.code === 'PGRST116') {
      return new TradingError(
        `No data found for ${operation}${table ? ` in ${table}` : ''}`,
        'NOT_FOUND',
        context
      );
    }
    
    if (error?.code?.startsWith('23')) {
      return new TradingError(
        `Database constraint violation during ${operation}`,
        'CONSTRAINT_VIOLATION',
        context
      );
    }
    
    return new TradingError(
      `Database error during ${operation}: ${error?.message || 'Unknown database error'}`,
      'DATABASE_ERROR',
      { ...context, originalError: error }
    );
  }

  static isRetryableError(error: TradingError): boolean {
    const retryableCodes = ['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMIT'];
    return retryableCodes.includes(error.code);
  }

  static getErrorSeverity(error: TradingError): 'low' | 'medium' | 'high' | 'critical' {
    switch (error.code) {
      case 'VALIDATION_ERROR':
      case 'MIN_ORDER_NOT_MET':
        return 'low';
      case 'NETWORK_ERROR':
      case 'NOT_FOUND':
        return 'medium';
      case 'INSUFFICIENT_BALANCE':
      case 'CONSTRAINT_VIOLATION':
        return 'high';
      case 'DATABASE_ERROR':
      case 'UNKNOWN_ERROR':
        return 'critical';
      default:
        return 'medium';
    }
  }
}
