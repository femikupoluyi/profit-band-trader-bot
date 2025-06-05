

import { supabase } from '@/integrations/supabase/client';
import { LogType } from './TypeDefinitions';

export class TradingLogger {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async logInfo(message: string, data?: any): Promise<void> {
    await this.log('info', message, data);
  }

  async logError(message: string, error?: any, data?: any): Promise<void> {
    // If error is provided, include it in the data
    const errorData = error ? {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      ...data
    } : data;
    
    await this.log('error', message, errorData);
  }

  async logSuccess(message: string, data?: any): Promise<void> {
    await this.log('success', message, data);
  }

  async logSystemInfo(message: string, data?: any): Promise<void> {
    await this.log('system_info', message, data);
  }

  async logSystemError(message: string, error?: any, data?: any): Promise<void> {
    // If error is provided, include it in the data
    const errorData = error ? {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      ...data
    } : data;
    
    await this.log('system_error', message, errorData);
  }

  async logSignalProcessed(message: string, data?: any): Promise<void> {
    await this.log('signal_processed', message, data);
  }

  async logTradeExecuted(message: string, data?: any): Promise<void> {
    await this.log('trade_executed', message, data);
  }

  async logTradeFilled(message: string, data?: any): Promise<void> {
    await this.log('trade_filled', message, data);
  }

  async logPositionClosed(message: string, data?: any): Promise<void> {
    await this.log('position_closed', message, data);
  }

  async logOrderPlaced(message: string, data?: any): Promise<void> {
    await this.log('order_placed', message, data);
  }

  async logOrderFailed(message: string, data?: any): Promise<void> {
    await this.log('order_failed', message, data);
  }

  async logCalculationError(message: string, error?: any, data?: any): Promise<void> {
    // If error is provided, include it in the data
    const errorData = error ? {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      ...data
    } : data;
    
    await this.log('calculation_error', message, errorData);
  }

  async logExecutionError(message: string, error?: any, data?: any): Promise<void> {
    // If error is provided, include it in the data
    const errorData = error ? {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      ...data
    } : data;
    
    await this.log('execution_error', message, errorData);
  }

  async logSignalRejected(message: string, data?: any): Promise<void> {
    await this.log('signal_rejected', message, data);
  }

  async logOrderRejected(message: string, data?: any): Promise<void> {
    await this.log('order_rejected', message, data);
  }

  // Add the missing logTradeAction method that other services expect
  async logTradeAction(message: string, symbol: string, data?: any): Promise<void> {
    const enhancedData = {
      symbol,
      ...data
    };
    await this.log('trade_executed', message, enhancedData);
  }

  // Make log method public so it can be accessed by other services
  async log(logType: LogType, message: string, data?: any): Promise<void> {
    try {
      console.log(`[${logType.toUpperCase()}] ${message}`, data || '');
      
      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: logType,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging to database:', error);
      // Don't throw error to avoid breaking main trading logic
    }
  }
}

