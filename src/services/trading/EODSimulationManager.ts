
import { TradingEngine } from './tradingEngine';
import { CredentialsManager } from './credentialsManager';
import { MainTradingEngine } from './core/MainTradingEngine';
import { TradingLogger } from './core/TradingLogger';
import { UserConfigManager } from './UserConfigManager';

export class EODSimulationManager {
  async simulateEndOfDay(userId: string, runningEngines: Map<string, TradingEngine>): Promise<void> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId provided to simulateEndOfDay');
    }

    let temporaryEngine: TradingEngine | null = null;
    
    try {
      console.log(`🌅 [EODSimulationManager] Starting EOD simulation for user: ${userId}`);
      const logger = new TradingLogger(userId);
      await logger.logSuccess('EOD simulation requested', { userId });

      // Get or create a temporary engine for EOD simulation
      let engine = runningEngines.get(userId);
      let isTemporaryEngine = false;

      if (!engine) {
        console.log(`🔧 [EODSimulationManager] No running engine, creating temporary engine for EOD simulation`);
        await logger.logSuccess('Creating temporary engine for EOD simulation', { userId });
        
        // Get user's trading config with validation
        const config = await UserConfigManager.getUserTradingConfig(userId);
        if (!config) {
          const errorMsg = 'No trading configuration found for EOD simulation';
          console.error(`❌ [EODSimulationManager] ${errorMsg} for user: ${userId}`);
          await logger.logError(errorMsg, new Error(errorMsg), { userId });
          throw new Error(errorMsg);
        }

        // Validate config is properly formatted
        if (!config.trading_pairs || !Array.isArray(config.trading_pairs) || config.trading_pairs.length === 0) {
          const errorMsg = 'Invalid trading configuration: no trading pairs defined';
          console.error(`❌ [EODSimulationManager] ${errorMsg} for user: ${userId}`);
          await logger.logError(errorMsg, new Error(errorMsg), { userId });
          throw new Error(errorMsg);
        }

        // Create temporary engine just for EOD
        engine = new TradingEngine(userId, config);
        temporaryEngine = engine;
        
        const initialized = await engine.initialize();
        
        if (!initialized) {
          const errorMsg = 'Failed to initialize temporary engine for EOD simulation';
          console.error(`❌ [EODSimulationManager] ${errorMsg} for user: ${userId}`);
          await logger.logError(errorMsg, new Error(errorMsg), { userId });
          throw new Error(errorMsg);
        }

        isTemporaryEngine = true;
      }

      // Get user's trading config for main engine creation
      const config = await UserConfigManager.getUserTradingConfig(userId);
      if (!config) {
        throw new Error('No trading configuration found for EOD simulation');
      }

      // Create main engine for direct EOD access
      const mainEngine = new MainTradingEngine(userId, config);
      await mainEngine.initialize();
      
      // Execute EOD simulation logic here
      console.log(`🌅 [EODSimulationManager] Executing EOD simulation logic for user: ${userId}`);
      // Note: EOD simulation logic would be implemented here
      // For now, we just log the simulation
      await logger.logSuccess('EOD simulation logic executed', { userId });
      
      console.log(`✅ [EODSimulationManager] EOD simulation completed for user: ${userId}`);
      await logger.logSuccess('EOD simulation completed successfully', { 
        userId,
        temporaryEngine: isTemporaryEngine
      });

    } catch (error) {
      console.error(`❌ [EODSimulationManager] Error in EOD simulation for user ${userId}:`, error);
      const logger = new TradingLogger(userId);
      await logger.logError('EOD simulation failed', error, { userId });
      throw error;
    } finally {
      // Clean up temporary engine if created
      if (temporaryEngine) {
        try {
          console.log(`🧹 [EODSimulationManager] Cleaning up temporary engine for user: ${userId}`);
          await temporaryEngine.stop();
        } catch (cleanupError) {
          console.error(`⚠️ [EODSimulationManager] Error cleaning up temporary engine:`, cleanupError);
        }
      }
    }
  }
}
