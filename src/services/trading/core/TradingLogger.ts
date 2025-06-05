
import { supabase } from '@/integrations/supabase/client';

export class TradingLogger {
  private userId: string;

  // Valid log types from database constraint - ONLY these are allowed
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

  constructor(userId: string) {
    this.userId = userId;
  }

  async log(type: string, message: string, data?: any): Promise<void> {
    try {
      // Always use a valid log type - no mapping, just use valid ones
      let validType: string;
      
      if (type.includes('error') || type.includes('fail')) {
        validType = 'system_error';
      } else if (type.includes('order') && type.includes('place')) {
        validType = 'order_placed';
      } else if (type.includes('order') && type.includes('fail')) {
        validType = 'order_failed';
      } else if (type.includes('close') || type.includes('position')) {
        validType = 'position_closed';
      } else if (type.includes('trade')) {
        validType = 'trade_executed';
      } else {
        validType = 'signal_processed'; // Default fallback
      }

      console.log(`📝 LOGGING: [${validType}] ${message}`);
      if (data) console.log('📝 LOG DATA:', data);

      const logEntry = {
        user_id: this.userId,
        log_type: validType,
        message: message,
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
