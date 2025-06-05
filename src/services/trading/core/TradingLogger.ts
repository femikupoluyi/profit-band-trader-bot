
import { supabase } from '@/integrations/supabase/client';
import { LogType, StandardizedError } from './TypeDefinitions';

export class TradingLogger {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Log a general message with specified type
   */
  async log(type: LogType, message: string, data?: any): Promise<void> {
    try {
      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: type,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging message:', error);
    }
  }

  /**
   * Log a success message
   */
  async logSuccess(message: string, data?: any): Promise<void> {
    return this.log('success', message, data);
  }

  /**
   * Log an error with proper formatting
   */
  async logError(message: string, error: any, context?: any): Promise<void> {
    const errorData: StandardizedError = {
      message: error instanceof Error ? error.message : String(error),
      code: error?.code || error?.retCode,
      details: error,
      context: context || 'unknown'
    };

    return this.log('error', message, errorData);
  }

  /**
   * Log system information
   */
  async logSystemInfo(message: string, data?: any): Promise<void> {
    return this.log('system_info', message, data);
  }

  /**
   * Log trade-related actions
   */
  async logTradeAction(action: string, symbol: string, data?: any): Promise<void> {
    const tradeData = {
      action,
      symbol,
      timestamp: new Date().toISOString(),
      ...data
    };

    return this.log('trade_executed', `${action}: ${symbol}`, tradeData);
  }

  /**
   * Log signal processing events
   */
  async logSignalProcessed(symbol: string, signalType: string, data?: any): Promise<void> {
    const signalData = {
      symbol,
      signalType,
      timestamp: new Date().toISOString(),
      ...data
    };

    return this.log('signal_processed', `Signal processed: ${signalType} for ${symbol}`, signalData);
  }

  /**
   * Log order placement events
   */
  async logOrderPlaced(symbol: string, orderType: string, data?: any): Promise<void> {
    const orderData = {
      symbol,
      orderType,
      timestamp: new Date().toISOString(),
      ...data
    };

    return this.log('order_placed', `Order placed: ${orderType} for ${symbol}`, orderData);
  }

  /**
   * Log order failures
   */
  async logOrderFailed(symbol: string, reason: string, data?: any): Promise<void> {
    const failureData = {
      symbol,
      reason,
      timestamp: new Date().toISOString(),
      ...data
    };

    return this.log('order_failed', `Order failed: ${reason} for ${symbol}`, failureData);
  }

  /**
   * Log position closures
   */
  async logPositionClosed(symbol: string, profit: number, data?: any): Promise<void> {
    const closureData = {
      symbol,
      profit,
      timestamp: new Date().toISOString(),
      ...data
    };

    return this.log('position_closed', `Position closed: ${symbol} P&L: $${profit.toFixed(2)}`, closureData);
  }

  /**
   * Log calculation errors
   */
  async logCalculationError(operation: string, error: any, data?: any): Promise<void> {
    const calcData = {
      operation,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      ...data
    };

    return this.log('calculation_error', `Calculation error in ${operation}`, calcData);
  }

  /**
   * Log execution errors
   */
  async logExecutionError(operation: string, error: any, data?: any): Promise<void> {
    const execData = {
      operation,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      ...data
    };

    return this.log('execution_error', `Execution error in ${operation}`, execData);
  }

  /**
   * Batch log multiple entries (for performance)
   */
  async logBatch(entries: Array<{ type: LogType; message: string; data?: any }>): Promise<void> {
    try {
      const logEntries = entries.map(entry => ({
        user_id: this.userId,
        log_type: entry.type,
        message: entry.message,
        data: entry.data || null,
      }));

      await supabase
        .from('trading_logs')
        .insert(logEntries);
    } catch (error) {
      console.error('Error batch logging:', error);
    }
  }
}
