
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { MainTradingEngine } from './core/MainTradingEngine';

/**
 * PHASE 2 CONSOLIDATED: Simplified Trading Engine wrapper
 * Delegates all functionality to MainTradingEngine for cleaner architecture
 */
export class TradingEngine {
  private mainEngine: MainTradingEngine;

  constructor(userId: string, config: TradingConfigData) {
    this.mainEngine = new MainTradingEngine(userId, config);
  }

  async initialize(): Promise<boolean> {
    try {
      await this.mainEngine.initialize();
      return true;
    } catch (error) {
      console.error('❌ Error initializing Trading Engine:', error);
      return false;
    }
  }

  async start(): Promise<void> {
    await this.mainEngine.start();
  }

  async stop(): Promise<void> {
    await this.mainEngine.stop();
  }

  isRunning(): boolean {
    return this.mainEngine.isEngineRunning();
  }
}
