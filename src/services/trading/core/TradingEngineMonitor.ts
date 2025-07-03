import { TradingLogger } from './TradingLogger';
import { supabase } from '@/integrations/supabase/client';

export class TradingEngineMonitor {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  /**
   * CRITICAL: Check if trading should continue based on configuration
   */
  async shouldContinueTrading(): Promise<boolean> {
    try {
      // Get fresh configuration from database
      const { data: config, error } = await supabase
        .from('trading_configs')
        .select('is_active')
        .eq('user_id', this.userId)
        .single();

      if (error || !config) {
        console.error('❌ Failed to check trading config - stopping for safety');
        await this.logger.logError('Failed to check trading config - stopping trading', error);
        return false;
      }

      if (!config.is_active) {
        console.log('🛑 Trading configuration is not active - should stop');
        await this.logger.logSystemInfo('Trading stopped due to inactive configuration');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error checking trading status:', error);
      await this.logger.logError('Error checking trading status', error);
      return false; // Fail safe - stop trading if we can't check
    }
  }

  /**
   * CRITICAL: Emergency check for runaway trading
   */
  async detectRunawayTrading(): Promise<boolean> {
    try {
      // Check for too many recent orders (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { count } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .gte('created_at', fiveMinutesAgo);

      const recentOrderCount = count || 0;
      
      if (recentOrderCount > 10) { // More than 10 orders in 5 minutes
        console.error(`🚨 RUNAWAY TRADING DETECTED: ${recentOrderCount} orders in last 5 minutes`);
        await this.logger.logError('Runaway trading detected - emergency stop', {
          recentOrderCount,
          timeframe: '5 minutes'
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Error detecting runaway trading:', error);
      return false;
    }
  }

  /**
   * CRITICAL: Get real-time position count for validation
   */
  async getCurrentPositionCount(symbol: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('side', 'buy')
        .in('status', ['pending', 'filled', 'partial_filled']);

      return count || 0;
    } catch (error) {
      console.error(`❌ Error getting position count for ${symbol}:`, error);
      return 999; // Return high number to block trading if we can't check
    }
  }
}