
import { supabase } from '@/integrations/supabase/client';

export class TradingLogger {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async logSystemInfo(message: string, data?: any): Promise<void> {
    try {
      await this.log('info', message, data);
    } catch (error) {
      console.error('Failed to log system info:', error);
    }
  }

  async logSuccess(message: string, data?: any): Promise<void> {
    try {
      await this.log('success', message, data);
    } catch (error) {
      console.error('Failed to log success:', error);
    }
  }

  async logError(message: string, error?: any, additionalData?: any): Promise<void> {
    try {
      const errorData = {
        message: error?.message || 'Unknown error',
        stack: error?.stack,
        ...additionalData
      };
      await this.log('error', message, errorData);
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  async logSignalProcessed(symbol: string, signalType: string, data?: any): Promise<void> {
    try {
      await this.log('signal_processed', `Signal processed: ${signalType} for ${symbol}`, {
        symbol,
        signalType,
        ...data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log signal processed:', error);
    }
  }

  async logOrderPlaced(symbol: string, orderType: string, data?: any): Promise<void> {
    try {
      await this.log('order_placed', `Order placed: ${orderType} for ${symbol}`, {
        symbol,
        orderType,
        ...data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log order placed:', error);
    }
  }

  async logSupportAnalysis(symbol: string, analysisData: any): Promise<void> {
    try {
      await this.log('support_analysis', `Support analysis completed for ${symbol}`, {
        symbol,
        ...analysisData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log support analysis:', error);
    }
  }

  async logTradeAction(action: string, symbol: string, data?: any): Promise<void> {
    try {
      await this.log('trade_action', `${action} for ${symbol}`, {
        action,
        symbol,
        ...data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log trade action:', error);
    }
  }

  async logSignalRejected(symbol: string, reason: string, data?: any): Promise<void> {
    try {
      await this.log('signal_rejected', `Signal rejected for ${symbol}: ${reason}`, {
        symbol,
        reason,
        ...data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log signal rejected:', error);
    }
  }

  async logEngineStatusChange(status: string, data?: any): Promise<void> {
    try {
      await this.log('engine_status', `Engine status changed to: ${status}`, {
        status,
        ...data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log engine status change:', error);
    }
  }

  async logConfigurationChange(data: any): Promise<void> {
    try {
      await this.log('configuration_change', 'Configuration changed', {
        ...data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log configuration change:', error);
    }
  }

  async logMarketDataUpdate(symbol: string, data: any, source?: string): Promise<void> {
    try {
      await this.log('market_data_update', `Market data updated for ${symbol}`, {
        symbol,
        source: source || 'unknown',
        ...data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log market data update:', error);
    }
  }

  // Make log method public so other services can use it
  async log(logType: string, message: string, data?: any): Promise<void> {
    const { error } = await supabase
      .from('trading_logs')
      .insert({
        user_id: this.userId,
        log_type: logType,
        message,
        data: data || {}
      });

    if (error) {
      console.error('Database logging failed:', error);
    }
  }
}
