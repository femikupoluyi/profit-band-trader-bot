import { TradingEngine } from './trading/tradingEngine';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { CredentialsManager } from './trading/credentialsManager';
import { MainTradingEngine } from './trading/core/MainTradingEngine';
import { TradingLogger } from './trading/core/TradingLogger';

class TradingManager {
  private runningEngines: Map<string, TradingEngine> = new Map();

  async startTradingForUser(userId: string): Promise<void> {
    try {
      console.log(`🚀 [TradingManager] Starting trading for user: ${userId}`);
      const logger = new TradingLogger(userId);
      await logger.logSuccess('Trading manager start requested', { userId });

      if (this.runningEngines.has(userId)) {
        console.log(`⚠️ [TradingManager] Trading already running for user: ${userId}`);
        await logger.logSuccess('Trading already running', { userId });
        return;
      }

      // Get user's trading config
      const config = await this.getUserTradingConfig(userId);
      if (!config) {
        const errorMsg = 'No trading configuration found';
        console.error(`❌ [TradingManager] ${errorMsg} for user: ${userId}`);
        await logger.logError(errorMsg, new Error(errorMsg), { userId });
        throw new Error(errorMsg);
      }

      console.log(`📋 [TradingManager] Config loaded for user ${userId}:`, {
        isActive: config.is_active,
        maxPairs: config.max_active_pairs,
        takeProfitPercent: config.take_profit_percent
      });

      if (!config.is_active) {
        const errorMsg = 'Trading configuration is not active';
        console.error(`❌ [TradingManager] ${errorMsg} for user: ${userId}`);
        await logger.logError(errorMsg, new Error(errorMsg), { userId });
        throw new Error(errorMsg);
      }

      // Create and initialize engine
      const engine = new TradingEngine(userId, config);
      const initialized = await engine.initialize();
      
      if (!initialized) {
        const errorMsg = 'Failed to initialize trading engine';
        console.error(`❌ [TradingManager] ${errorMsg} for user: ${userId}`);
        await logger.logError(errorMsg, new Error(errorMsg), { userId });
        throw new Error(errorMsg);
      }

      // Start the engine
      await engine.start();
      
      // Store in running engines
      this.runningEngines.set(userId, engine);
      
      console.log(`✅ [TradingManager] Trading started successfully for user: ${userId}`);
      await logger.logSuccess('Trading started successfully', { 
        userId,
        configActive: config.is_active,
        tradingPairs: config.trading_pairs?.length || 0
      });

    } catch (error) {
      console.error(`❌ [TradingManager] Error starting trading for user ${userId}:`, error);
      const logger = new TradingLogger(userId);
      await logger.logError('Failed to start trading', error, { userId });
      throw error;
    }
  }

  async stopTradingForUser(userId: string): Promise<void> {
    try {
      console.log(`🛑 [TradingManager] Stopping trading for user: ${userId}`);
      const logger = new TradingLogger(userId);
      await logger.logSuccess('Trading manager stop requested', { userId });

      const engine = this.runningEngines.get(userId);
      if (!engine) {
        console.log(`⚠️ [TradingManager] No running engine found for user: ${userId}`);
        await logger.logSuccess('No running engine found', { userId });
        return;
      }

      await engine.stop();
      this.runningEngines.delete(userId);
      
      console.log(`✅ [TradingManager] Trading stopped successfully for user: ${userId}`);
      await logger.logSuccess('Trading stopped successfully', { userId });

    } catch (error) {
      console.error(`❌ [TradingManager] Error stopping trading for user ${userId}:`, error);
      const logger = new TradingLogger(userId);
      await logger.logError('Failed to stop trading', error, { userId });
      throw error;
    }
  }

  async restartTradingForUser(userId: string): Promise<void> {
    try {
      console.log(`🔄 [TradingManager] Restarting trading for user: ${userId}`);
      const logger = new TradingLogger(userId);
      await logger.logSuccess('Trading manager restart requested', { userId });

      await this.stopTradingForUser(userId);
      await this.startTradingForUser(userId);
      
      console.log(`✅ [TradingManager] Trading restarted successfully for user: ${userId}`);
      await logger.logSuccess('Trading restarted successfully', { userId });

    } catch (error) {
      console.error(`❌ [TradingManager] Error restarting trading for user ${userId}:`, error);
      const logger = new TradingLogger(userId);
      await logger.logError('Failed to restart trading', error, { userId });
      throw error;
    }
  }

  isRunningForUser(userId: string): boolean {
    const isRunning = this.runningEngines.has(userId) && 
                     this.runningEngines.get(userId)?.isRunning() === true;
    console.log(`🔍 [TradingManager] User ${userId} trading status: ${isRunning ? 'RUNNING' : 'STOPPED'}`);
    return isRunning;
  }

  async simulateEndOfDay(userId: string): Promise<void> {
    try {
      console.log(`🌅 [TradingManager] Starting EOD simulation for user: ${userId}`);
      const logger = new TradingLogger(userId);
      await logger.logSuccess('EOD simulation requested', { userId });

      // Get or create a temporary engine for EOD simulation
      let engine = this.runningEngines.get(userId);
      let temporaryEngine = false;

      if (!engine) {
        console.log(`🔧 [TradingManager] No running engine, creating temporary engine for EOD simulation`);
        await logger.logSuccess('Creating temporary engine for EOD simulation', { userId });
        
        // Get user's trading config
        const config = await this.getUserTradingConfig(userId);
        if (!config) {
          const errorMsg = 'No trading configuration found for EOD simulation';
          console.error(`❌ [TradingManager] ${errorMsg} for user: ${userId}`);
          await logger.logError(errorMsg, new Error(errorMsg), { userId });
          throw new Error(errorMsg);
        }

        // Create temporary engine just for EOD
        engine = new TradingEngine(userId, config);
        const initialized = await engine.initialize();
        
        if (!initialized) {
          const errorMsg = 'Failed to initialize temporary engine for EOD simulation';
          console.error(`❌ [TradingManager] ${errorMsg} for user: ${userId}`);
          await logger.logError(errorMsg, new Error(errorMsg), { userId });
          throw new Error(errorMsg);
        }

        temporaryEngine = true;
      }

      // Get the main engine directly to access simulateEndOfDay
      const credentialsManager = new CredentialsManager(userId);
      const bybitService = await credentialsManager.fetchCredentials();
      
      if (!bybitService) {
        const errorMsg = 'Failed to get Bybit service for EOD simulation';
        console.error(`❌ [TradingManager] ${errorMsg} for user: ${userId}`);
        await logger.logError(errorMsg, new Error(errorMsg), { userId });
        throw new Error(errorMsg);
      }

      // Create main engine for direct EOD access
      const mainEngine = new MainTradingEngine(userId, bybitService);
      await mainEngine.initialize();
      
      // Execute EOD simulation
      await mainEngine.simulateEndOfDay();
      
      console.log(`✅ [TradingManager] EOD simulation completed for user: ${userId}`);
      await logger.logSuccess('EOD simulation completed successfully', { 
        userId,
        temporaryEngine
      });

    } catch (error) {
      console.error(`❌ [TradingManager] Error in EOD simulation for user ${userId}:`, error);
      const logger = new TradingLogger(userId);
      await logger.logError('EOD simulation failed', error, { userId });
      throw error;
    }
  }

  private async getUserTradingConfig(userId: string): Promise<TradingConfigData | null> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data: config, error } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching trading config:', error);
        return null;
      }

      if (!config) {
        console.error('No trading config found for user:', userId);
        return null;
      }

      // Convert database config to TradingConfigData format
      return {
        max_active_pairs: config.max_active_pairs || 5,
        max_order_amount_usd: config.max_order_amount_usd || 100,
        max_portfolio_exposure_percent: config.max_portfolio_exposure_percent || 25,
        daily_reset_time: config.daily_reset_time || '00:00:00',
        chart_timeframe: config.chart_timeframe || '4h',
        entry_offset_percent: config.entry_offset_percent || 0.5,
        take_profit_percent: config.take_profit_percent || 1.0,
        support_candle_count: config.support_candle_count || 128,
        max_positions_per_pair: config.max_positions_per_pair || 2,
        new_support_threshold_percent: config.new_support_threshold_percent || 2.0,
        trading_pairs: config.trading_pairs || ['BTCUSDT'],
        is_active: config.is_active || false,
        main_loop_interval_seconds: config.main_loop_interval_seconds || 30,
        auto_close_at_end_of_day: config.auto_close_at_end_of_day || false,
        eod_close_premium_percent: config.eod_close_premium_percent || 0.1,
        manual_close_premium_percent: config.manual_close_premium_percent || 0.1,
        support_lower_bound_percent: config.support_lower_bound_percent || 5.0,
        support_upper_bound_percent: config.support_upper_bound_percent || 2.0,
      };
    } catch (error) {
      console.error('Error in getUserTradingConfig:', error);
      return null;
    }
  }
}

export const tradingManager = new TradingManager();
