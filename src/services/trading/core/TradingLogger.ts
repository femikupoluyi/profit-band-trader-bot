
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
    console.log(`✅ [TradingLogger] ${message}`, data);
    await this.log('system_info', message, data);
  }

  async logError(message: string, error: any, data?: any): Promise<void> {
    console.error(`❌ [TradingLogger] ${message}`, error, data);
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

  async logWarning(message: string, data?: any): Promise<void> {
    console.warn(`⚠️ [TradingLogger] ${message}`, data);
    await this.log('system_info', `WARNING: ${message}`, data);
  }

  async logSystemInfo(message: string, data?: any): Promise<void> {
    console.log(`ℹ️ [TradingLogger] ${message}`, data);
    await this.log('system_info', message, data);
  }

  // Enhanced logging methods with detailed context
  async logTradeAction(message: string, symbol: string, data?: any): Promise<void> {
    console.log(`🔄 [TRADE ACTION] ${symbol}: ${message}`, data);
    await this.log('trade_executed', message, { symbol, timestamp: new Date().toISOString(), ...data });
  }

  async logSignalProcessed(symbol: string, signalType: string, data?: any): Promise<void> {
    console.log(`📊 [SIGNAL] ${symbol}: ${signalType} signal processed`, data);
    await this.log('signal_processed', `Signal processed: ${signalType} for ${symbol}`, { 
      symbol, 
      signalType, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }

  async logSignalRejected(symbol: string, reason: string, data?: any): Promise<void> {
    console.log(`❌ [SIGNAL REJECTED] ${symbol}: ${reason}`, data);
    await this.log('signal_rejected', `Signal rejected for ${symbol}: ${reason}`, { 
      symbol, 
      reason, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }

  async logOrderPlaced(symbol: string, orderData: any): Promise<void> {
    console.log(`📝 [ORDER PLACED] ${symbol}:`, orderData);
    await this.log('order_placed', `Order placed for ${symbol}`, { 
      symbol, 
      timestamp: new Date().toISOString(),
      ...orderData 
    });
  }

  async logOrderRejected(symbol: string, reason: string, orderData?: any): Promise<void> {
    console.log(`❌ [ORDER REJECTED] ${symbol}: ${reason}`, orderData);
    await this.log('order_rejected', `Order rejected for ${symbol}: ${reason}`, { 
      symbol, 
      reason, 
      timestamp: new Date().toISOString(),
      ...orderData 
    });
  }

  async logMarketDataUpdate(symbol: string, price: number, source: string): Promise<void> {
    console.log(`📈 [MARKET DATA] ${symbol}: $${price} from ${source}`);
    await this.log('system_info', `Market data updated for ${symbol}`, { 
      symbol, 
      price, 
      source, 
      timestamp: new Date().toISOString()
    });
  }

  async logConfigurationChange(changes: any): Promise<void> {
    console.log(`⚙️ [CONFIG CHANGE]`, changes);
    await this.log('system_info', 'Trading configuration updated', { 
      changes, 
      timestamp: new Date().toISOString()
    });
  }

  async logEngineStatusChange(status: string, details?: any): Promise<void> {
    console.log(`🤖 [ENGINE STATUS] ${status}`, details);
    await this.log('system_info', `Trading engine status: ${status}`, { 
      status, 
      timestamp: new Date().toISOString(),
      ...details 
    });
  }

  async logPositionValidation(symbol: string, result: boolean, reason: string, data?: any): Promise<void> {
    console.log(`🔍 [POSITION VALIDATION] ${symbol}: ${result ? 'PASSED' : 'FAILED'} - ${reason}`, data);
    await this.log('system_info', `Position validation for ${symbol}: ${result ? 'passed' : 'failed'} - ${reason}`, { 
      symbol, 
      validationResult: result, 
      reason, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }

  async logCycleStart(cycleNumber: number, config: any): Promise<void> {
    console.log(`🔄 [CYCLE START] Cycle #${cycleNumber}`, { 
      isActive: config.is_active,
      tradingPairs: config.trading_pairs?.length || 0,
      maxOrderAmount: config.max_order_amount_usd 
    });
    await this.log('system_info', `Trading cycle #${cycleNumber} started`, { 
      cycleNumber, 
      config: {
        isActive: config.is_active,
        tradingPairsCount: config.trading_pairs?.length || 0,
        maxOrderAmount: config.max_order_amount_usd,
        takeProfitPercent: config.take_profit_percent
      },
      timestamp: new Date().toISOString()
    });
  }

  async logCycleComplete(cycleNumber: number, summary: any): Promise<void> {
    console.log(`✅ [CYCLE COMPLETE] Cycle #${cycleNumber}`, summary);
    await this.log('system_info', `Trading cycle #${cycleNumber} completed`, { 
      cycleNumber, 
      summary, 
      timestamp: new Date().toISOString()
    });
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
        console.warn(`⚠️ Invalid log type '${logType}' mapped to 'system_info'`);
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
        console.error('❌ Failed to insert trading log:', error);
      }
    } catch (error) {
      console.error('❌ Error in TradingLogger.log:', error);
    }
  }
}
