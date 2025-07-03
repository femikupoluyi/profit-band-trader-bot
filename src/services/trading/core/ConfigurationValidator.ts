import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';

export class ConfigurationValidator {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  /**
   * CRITICAL: Validate configuration before ANY trading operation
   */
  async validateConfigurationIntegrity(config: TradingConfigData): Promise<{
    isValid: boolean;
    errors: string[];
    criticalErrors: string[];
  }> {
    const errors: string[] = [];
    const criticalErrors: string[] = [];

    try {
      console.log('🔍 CRITICAL: Validating trading configuration integrity...');
      console.log('📊 Configuration to validate:', {
        isActive: config.is_active,
        maxActivePairs: config.max_active_pairs,
        maxPositionsPerPair: config.max_positions_per_pair,
        maxOrderAmount: config.max_order_amount_usd,
        tradingPairs: config.trading_pairs.length
      });

      // CRITICAL CHECK 1: Configuration must be active
      if (!config.is_active) {
        criticalErrors.push('Trading configuration is not active');
      }

      // CRITICAL CHECK 2: Trading pairs must be configured
      if (!config.trading_pairs || config.trading_pairs.length === 0) {
        criticalErrors.push('No trading pairs configured');
      }

      // CRITICAL CHECK 3: Position limits must be reasonable
      if (config.max_positions_per_pair < 1 || config.max_positions_per_pair > 100) {
        criticalErrors.push(`Invalid max positions per pair: ${config.max_positions_per_pair} (must be 1-100)`);
      }

      if (config.max_active_pairs < 1 || config.max_active_pairs > 100) {
        criticalErrors.push(`Invalid max active pairs: ${config.max_active_pairs} (must be 1-100)`);
      }

      // CRITICAL CHECK 4: Order amount limits
      if (config.max_order_amount_usd <= 0 || config.max_order_amount_usd > 100000) {
        criticalErrors.push(`Invalid max order amount: $${config.max_order_amount_usd} (must be $1-$100,000)`);
      }

      // WARNING CHECKS
      if (config.max_order_amount_usd > 10000) {
        errors.push(`High order amount detected: $${config.max_order_amount_usd} - verify this is intentional`);
      }

      if (config.max_positions_per_pair > 10) {
        errors.push(`High positions per pair: ${config.max_positions_per_pair} - verify this is intentional`);
      }

      const result = {
        isValid: criticalErrors.length === 0,
        errors,
        criticalErrors
      };

      if (criticalErrors.length > 0) {
        console.error('🚨 CRITICAL CONFIGURATION ERRORS:', criticalErrors);
        await this.logger.logError('Critical configuration validation failed', { 
          criticalErrors, 
          errors,
          config: {
            isActive: config.is_active,
            maxActivePairs: config.max_active_pairs,
            maxPositionsPerPair: config.max_positions_per_pair,
            maxOrderAmount: config.max_order_amount_usd
          }
        });
      } else if (errors.length > 0) {
        console.warn('⚠️ Configuration warnings:', errors);
        await this.logger.logSystemInfo('Configuration validation warnings', { errors });
      } else {
        console.log('✅ Configuration validation passed');
      }

      return result;

    } catch (error) {
      console.error('❌ Error validating configuration:', error);
      return {
        isValid: false,
        errors: [],
        criticalErrors: [`Validation error: ${error.message}`]
      };
    }
  }

  /**
   * Real-time safety check before order execution
   */
  async performRealTimeSafetyCheck(): Promise<{
    isSafe: boolean;
    reason?: string;
  }> {
    try {
      // Check if trading is still enabled
      const { data: config, error } = await supabase
        .from('trading_configs')
        .select('is_active')
        .eq('user_id', this.userId)
        .single();

      if (error || !config) {
        return { isSafe: false, reason: 'Cannot verify trading configuration' };
      }

      if (!config.is_active) {
        return { isSafe: false, reason: 'Trading configuration has been disabled' };
      }

      // Check for recent excessive trading (last 1 minute)
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const { count } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .gte('created_at', oneMinuteAgo);

      const recentTrades = count || 0;
      if (recentTrades > 3) { // More than 3 trades in 1 minute
        console.error(`🚨 EXCESSIVE TRADING DETECTED: ${recentTrades} trades in last minute`);
        
        // Emergency disable
        await supabase
          .from('trading_configs')
          .update({ is_active: false })
          .eq('user_id', this.userId);

        return { 
          isSafe: false, 
          reason: `Excessive trading detected: ${recentTrades} trades in last minute - configuration disabled` 
        };
      }

      return { isSafe: true };

    } catch (error) {
      console.error('❌ Error in real-time safety check:', error);
      return { isSafe: false, reason: `Safety check failed: ${error.message}` };
    }
  }
}