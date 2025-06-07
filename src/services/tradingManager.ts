
import { EngineLifecycleManager } from './trading/EngineLifecycleManager';
import { EODSimulationManager } from './trading/EODSimulationManager';

class TradingManager {
  private engineManager: EngineLifecycleManager;
  private eodManager: EODSimulationManager;

  constructor() {
    this.engineManager = new EngineLifecycleManager();
    this.eodManager = new EODSimulationManager();
  }

  async startTradingForUser(userId: string): Promise<void> {
    return this.engineManager.startEngine(userId);
  }

  async stopTradingForUser(userId: string): Promise<void> {
    return this.engineManager.stopEngine(userId);
  }

  async restartTradingForUser(userId: string): Promise<void> {
    return this.engineManager.restartEngine(userId);
  }

  isRunningForUser(userId: string): boolean {
    return this.engineManager.isEngineRunning(userId);
  }

  async simulateEndOfDay(userId: string): Promise<void> {
    // Pass the running engines map from the engine manager to the EOD manager
    const runningEngine = this.engineManager.getRunningEngine(userId);
    const runningEngines = new Map();
    if (runningEngine) {
      runningEngines.set(userId, runningEngine);
    }
    
    return this.eodManager.simulateEndOfDay(userId, runningEngines);
  }
}

export const tradingManager = new TradingManager();
