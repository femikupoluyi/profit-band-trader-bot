
import { MainTradingEngine } from './trading/core/MainTradingEngine';
import { BybitService } from './bybitService';

class TradingManager {
  private engines: Map<string, MainTradingEngine> = new Map();

  async startTradingForUser(userId: string): Promise<void> {
    try {
      console.log(`Starting trading for user: ${userId}`);
      
      // Stop existing engine if running
      if (this.engines.has(userId)) {
        await this.stopTradingForUser(userId);
      }

      // Create and initialize new engine
      const bybitService = new BybitService(userId);
      const engine = new MainTradingEngine(userId, bybitService);
      
      await engine.initialize();
      await engine.start();
      
      this.engines.set(userId, engine);
      
      console.log(`Trading started successfully for user: ${userId}`);
    } catch (error) {
      console.error(`Failed to start trading for user ${userId}:`, error);
      throw error;
    }
  }

  async stopTradingForUser(userId: string): Promise<void> {
    try {
      const engine = this.engines.get(userId);
      if (engine) {
        await engine.stop();
        this.engines.delete(userId);
        console.log(`Trading stopped for user: ${userId}`);
      }
    } catch (error) {
      console.error(`Failed to stop trading for user ${userId}:`, error);
      throw error;
    }
  }

  async restartTradingForUser(userId: string): Promise<void> {
    await this.stopTradingForUser(userId);
    await this.startTradingForUser(userId);
  }

  isRunningForUser(userId: string): boolean {
    const engine = this.engines.get(userId);
    return engine ? engine.isEngineRunning() : false;
  }

  getEngineForUser(userId: string): MainTradingEngine | undefined {
    return this.engines.get(userId);
  }

  async manualClosePosition(userId: string, tradeId: string): Promise<void> {
    const engine = this.engines.get(userId);
    if (!engine) {
      throw new Error('Trading engine not running for user');
    }
    return engine.manualClosePosition(tradeId);
  }

  async simulateEndOfDay(userId: string): Promise<void> {
    console.log('🌅 Manual EOD simulation requested for user:', userId);
    
    // Check if engine is running, if not create a temporary one for EOD
    let engine = this.engines.get(userId);
    let isTemporaryEngine = false;
    
    if (!engine) {
      console.log('No running engine found, creating temporary engine for EOD simulation');
      try {
        const bybitService = new BybitService(userId);
        engine = new MainTradingEngine(userId, bybitService);
        await engine.initialize();
        isTemporaryEngine = true;
      } catch (error) {
        console.error('Failed to create temporary engine for EOD:', error);
        throw new Error('Failed to initialize trading engine for EOD simulation');
      }
    }
    
    try {
      await engine.simulateEndOfDay();
      console.log('✅ EOD simulation completed successfully');
    } finally {
      // Clean up temporary engine if created
      if (isTemporaryEngine && engine) {
        console.log('Cleaning up temporary engine');
        // No need to call stop() since it wasn't started
      }
    }
  }
}

export const tradingManager = new TradingManager();
