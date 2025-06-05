
import { TradingLogger } from './TradingLogger';

export class ErrorHandler {
  private logger: TradingLogger;

  constructor(logger: TradingLogger) {
    this.logger = logger;
  }

  async handleApiError(error: any, context: string): Promise<string> {
    const errorMessage = this.extractErrorMessage(error);
    const fullMessage = `${context}: ${errorMessage}`;
    
    await this.logger.logError(fullMessage, {
      error: error?.message || 'Unknown error',
      context,
      stack: error?.stack
    });

    return fullMessage;
  }

  async handleSystemError(error: any, context: string): Promise<string> {
    const errorMessage = this.extractErrorMessage(error);
    const fullMessage = `System error in ${context}: ${errorMessage}`;
    
    await this.logger.logError(fullMessage, {
      error: error?.message || 'Unknown error',
      context,
      stack: error?.stack
    });

    return fullMessage;
  }

  async handleExecutionError(error: any, context: string): Promise<string> {
    const errorMessage = this.extractErrorMessage(error);
    const fullMessage = `Execution error in ${context}: ${errorMessage}`;
    
    await this.logger.logExecutionError(fullMessage, {
      error: error?.message || 'Unknown error',
      context,
      stack: error?.stack
    });

    return fullMessage;
  }

  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error?.message) {
      return error.message;
    }
    
    if (error?.retMsg) {
      return error.retMsg;
    }
    
    if (error?.error_message) {
      return error.error_message;
    }

    return 'Unknown error occurred';
  }
}
