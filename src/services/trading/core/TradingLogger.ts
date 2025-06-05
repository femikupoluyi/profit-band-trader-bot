
import { supabase } from '@/integrations/supabase/client';

export class TradingLogger {
  private userId: string;

  constructor(userId: string) {
    if (!userId) {
      throw new Error('UserId is required for TradingLogger');
    }
    this.userId = userId;
  }

  async logSuccess(message: string, data?: any): Promise<void> {
    await this.log('system_info', message, data);
  }

  async logError(message: string, error: any, data?: any): Promise<void> {
    const errorData = {
      ...data,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    };
    await this.log('system_error', message, errorData);
  }

  async logSystemInfo(message: string, data?: any): Promise<void> {
    await this.log('system_info', message, data);
  }

  // Add missing public methods that other services are trying to use
  async logTradeAction(message: string, symbol: string, data?: any): Promise<void> {
    await this.log('trade_executed', message, { symbol, ...data });
  }

  async logSignalProcessed(symbol: string, signalType: string, data?: any): Promise<void> {
    await this.log('signal_processed', `Signal processed: ${signalType} for ${symbol}`, { symbol, signalType, ...data });
  }

  // Make log method public so other services can use it
  async log(logType: string, message: string, data?: any): Promise<void> {
    try {
      // Validate log type against database constraints
      const validLogTypes = [
        'signal_processed', 'trade_executed', 'trade_filled', 'position_closed',
        'system_error', 'order_placed', 'order_failed', 'calculation_error',
        'execution_error', 'signal_rejected', 'order_rejected', 'system_info'
      ];

      const validType = validLogTypes.includes(logType) ? logType : 'system_info';

      if (validType !== logType) {
        console.warn(`Invalid log type '${logType}' mapped to 'system_info'`);
      }

      const { error } = await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: validType,
          message: message || 'No message provided',
          data: data || null,
        });

      if (error) {
        console.error('Failed to insert trading log:', error);
      }
    } catch (error) {
      console.error('Error in TradingLogger.log:', error);
    }
  }
}
