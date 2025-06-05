
import { TradingEngine } from './tradingEngine';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { CredentialsManager } from './credentialsManager';
import { MainTradingEngine } from './core/MainTradingEngine';
import { TradingLogger } from './core/TradingLogger';
import { UserConfigManager } from './UserConfigManager';

export class EngineLifecycleManager {
  private runningEngines: Map<string, TradingEngine> = new Map();

  async startEngine(userId: string): Promise<void> {
    try {
      console.log(`🚀 [EngineLifecycleManager] Starting trading for user: ${userId}`);
      const logger = new TradingLogger(userId);
      await logger.logSuccess('Trading engine start requested', { userId });

      if (this.runningEngines.has(userId)) {
        console.log(`⚠️ [EngineLifecycleManager] Trading already running for user: ${userId}`);
        await logger.logSuccess('Trading already running', { userId });
        return;
      }

      // Get user's trading config
      const config = await UserConfigManager.getUserTradingConfig(userId);
      if (!config) {
        const errorMsg = 'No trading configuration found';
        console.error(`❌ [EngineLifecycleManager] ${errorMsg} for user: ${userId}`);
        await logger.logError(errorMsg, new Error(errorMsg), { userId });
        throw new Error(errorMsg);
      }

      console.log(`📋 [EngineLifecycleManager] Config loaded for user ${userId}:`, {
        isActive: config.is_active,
        maxPairs: config.max_active_pairs,
        takeProfitPercent: config.take_profit_percent
      });

      if (!config.is_active) {
        const errorMsg = 'Trading configuration is not active';
        console.error(`❌ [EngineLifecycleManager] ${errorMsg} for user: ${userId}`);
        await logger.logError(errorMsg, new Error(errorMsg), { userId });
        throw new Error(errorMsg);
      }

      // Create and initialize engine
      const engine = new TradingEngine(userId, config);
      const initialized = await engine.initialize();
      
      if (!initialized) {
        const errorMsg = 'Failed to initialize trading engine';
        console.error(`❌ [EngineLifecycleManager] ${errorMsg} for user: ${userId}`);
        await logger.logError(errorMsg, new Error(errorMsg), { userId });
        throw new Error(errorMsg);
      }

      // Start the engine
      await engine.start();
      
      // Store in running engines
      this.runningEngines.set(userId, engine);
      
      console.log(`✅ [EngineLifecycleManager] Trading started successfully for user: ${userId}`);
      await logger.logSuccess('Trading started successfully', { 
        userId,
        configActive: config.is_active,
        tradingPairs: config.trading_pairs?.length || 0
      });

    } catch (error) {
      console.error(`❌ [EngineLifecycleManager] Error starting trading for user ${userId}:`, error);
      const logger = new TradingLogger(userId);
      await logger.logError('Failed to start trading', error, { userId });
      throw error;
    }
  }

  async stopEngine(userId: string): Promise<void> {
    try {
      console.log(`🛑 [EngineLifecycleManager] Stopping trading for user: ${userId}`);
      const logger = new TradingLogger(userId);
      await logger.logSuccess('Trading engine stop requested', { userId });

      const engine = this.runningEngines.get(userId);
      if (!engine) {
        console.log(`⚠️ [EngineLifecycleManager] No running engine found for user: ${userId}`);
        await logger.logSuccess('No running engine found', { userId });
        return;
      }

      await engine.stop();
      this.runningEngines.delete(userId);
      
      console.log(`✅ [EngineLifecycleManager] Trading stopped successfully for user: ${userId}`);
      await logger.logSuccess('Trading stopped successfully', { userId });

    } catch (error) {
      console.error(`❌ [EngineLifecycleManager] Error stopping trading for user ${userId}:`, error);
      const logger = new TradingLogger(userId);
      await logger.logError('Failed to stop trading', error, { userId });
      throw error;
    }
  }

  async restartEngine(userId: string): Promise<void> {
    try {
      console.log(`🔄 [EngineLifecycleManager] Restarting trading for user: ${userId}`);
      const logger = new TradingLogger(userId);
      await logger.logSuccess('Trading engine restart requested', { userId });

      await this.stopEngine(userId);
      await this.startEngine(userId);
      
      console.log(`✅ [EngineLifecycleManager] Trading restarted successfully for user: ${userId}`);
      await logger.logSuccess('Trading restarted successfully', { userId });

    } catch (error) {
      console.error(`❌ [EngineLifecycleManager] Error restarting trading for user ${userId}:`, error);
      const logger = new TradingLogger(userId);
      await logger.logError('Failed to restart trading', error, { userId });
      throw error;
    }
  }

  isEngineRunning(userId: string): boolean {
    const isRunning = this.runningEngines.has(userId) && 
                     this.runningEngines.get(userId)?.isRunning() === true;
    console.log(`🔍 [EngineLifecycleManager] User ${userId} trading status: ${isRunning ? 'RUNNING' : 'STOPPED'}`);
    return isRunning;
  }

  getRunningEngine(userId: string): TradingEngine | undefined {
    return this.runningEngines.get(userId);
  }
}
