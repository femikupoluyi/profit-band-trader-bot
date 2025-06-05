
import { TradingEngine } from './tradingEngine';
import { CredentialsManager } from './credentialsManager';
import { MainTradingEngine } from './core/MainTradingEngine';
import { TradingLogger } from './core/TradingLogger';
import { UserConfigManager } from './UserConfigManager';

export class EODSimulationManager {
  async simulateEndOfDay(userId: string, runningEngines: Map<string, TradingEngine>): Promise<void> {
    try {
      console.log(`🌅 [EODSimulationManager] Starting EOD simulation for user: ${userId}`);
      const logger = new TradingLogger(userId);
      await logger.logSuccess('EOD simulation requested', { userId });

      // Get or create a temporary engine for EOD simulation
      let engine = runningEngines.get(userId);
      let temporaryEngine = false;

      if (!engine) {
        console.log(`🔧 [EODSimulationManager] No running engine, creating temporary engine for EOD simulation`);
        await logger.logSuccess('Creating temporary engine for EOD simulation', { userId });
        
        // Get user's trading config
        const config = await UserConfigManager.getUserTradingConfig(userId);
        if (!config) {
          const errorMsg = 'No trading configuration found for EOD simulation';
          console.error(`❌ [EODSimulationManager] ${errorMsg} for user: ${userId}`);
          await logger.logError(errorMsg, new Error(errorMsg), { userId });
          throw new Error(errorMsg);
        }

        // Create temporary engine just for EOD
        engine = new TradingEngine(userId, config);
        const initialized = await engine.initialize();
        
        if (!initialized) {
          const errorMsg = 'Failed to initialize temporary engine for EOD simulation';
          console.error(`❌ [EODSimulationManager] ${errorMsg} for user: ${userId}`);
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
        console.error(`❌ [EODSimulationManager] ${errorMsg} for user: ${userId}`);
        await logger.logError(errorMsg, new Error(errorMsg), { userId });
        throw new Error(errorMsg);
      }

      // Create main engine for direct EOD access
      const mainEngine = new MainTradingEngine(userId, bybitService);
      await mainEngine.initialize();
      
      // Execute EOD simulation
      await mainEngine.simulateEndOfDay();
      
      console.log(`✅ [EODSimulationManager] EOD simulation completed for user: ${userId}`);
      await logger.logSuccess('EOD simulation completed successfully', { 
        userId,
        temporaryEngine
      });

    } catch (error) {
      console.error(`❌ [EODSimulationManager] Error in EOD simulation for user ${userId}:`, error);
      const logger = new TradingLogger(userId);
      await logger.logError('EOD simulation failed', error, { userId });
      throw error;
    }
  }
}
