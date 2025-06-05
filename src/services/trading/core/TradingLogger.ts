
import { supabase } from '@/integrations/supabase/client';

export class TradingLogger {
  private userId: string;

  // Valid log types from database constraint
  private static readonly VALID_LOG_TYPES = [
    'signal_processed',
    'trade_executed',
    'trade_filled',
    'position_closed',
    'system_error',
    'order_placed',
    'order_failed',
    'calculation_error',
    'execution_error',
    'signal_rejected',
    'order_rejected'
  ] as const;

  // Mapping of common log types to valid database types
  private static readonly LOG_TYPE_MAPPING: Record<string, typeof TradingLogger.VALID_LOG_TYPES[number]> = {
    'manual_close': 'position_closed',
    'eod_close': 'position_closed',
    'eod_started': 'signal_processed',
    'eod_completed': 'signal_processed',
    'system_info': 'signal_processed',
    'engine_started': 'signal_processed',
    'engine_stopped': 'signal_processed',
    'close_error': 'execution_error',
    'close_rejected': 'order_rejected',
    'trade_closed': 'position_closed',
    'debug': 'signal_processed',
    'info': 'signal_processed'
  };

  constructor(userId: string) {
    this.userId = userId;
  }

  async log(type: string, message: string, data?: any): Promise<void> {
    try {
      // Map the type to a valid database type
      const validType = TradingLogger.LOG_TYPE_MAPPING[type] || 
        (TradingLogger.VALID_LOG_TYPES.includes(type as any) ? type : 'signal_processed');

      console.log(`📝 LOGGING: [${validType}] ${message}`, data);

      const logEntry = {
        user_id: this.userId,
        log_type: validType,
        message,
        data: data || null,
      };

      const { error } = await supabase
        .from('trading_logs')
        .insert(logEntry);

      if (error) {
        console.error('❌ Failed to insert log:', error);
        console.error('❌ Log entry that failed:', logEntry);
      } else {
        console.log('✅ Log entry successful');
      }
    } catch (error) {
      console.error('❌ Exception in logging:', error);
    }
  }

  async logError(message: string, error: any, data?: any): Promise<void> {
    const errorData = {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    await this.log('system_error', message, errorData);
  }

  async logSuccess(message: string, data?: any): Promise<void> {
    await this.log('signal_processed', message, {
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  async logTradeAction(action: string, symbol: string, data?: any): Promise<void> {
    await this.log('trade_executed', `${action}: ${symbol}`, {
      action,
      symbol,
      timestamp: new Date().toISOString(),
      ...data
    });
  }
}
