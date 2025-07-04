
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { MainTradingEngine } from './core/MainTradingEngine';

/**
 * PHASE 2 CONSOLIDATED: LoopManager now delegates to MainTradingEngine
 * Simplified architecture with cleaner separation of concerns
 * @deprecated Use MainTradingEngine directly for new implementations
 */
export class LoopManager {
  private mainEngine: MainTradingEngine;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(userId: string, config: TradingConfigData) {
    this.mainEngine = new MainTradingEngine(userId, config);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Trading loop already running');
      return;
    }

    try {
      await this.mainEngine.initialize();
      await this.mainEngine.start();
      this.isRunning = true;
      console.log('✅ TRADING LOOP STARTED (delegated to MainTradingEngine)');
    } catch (error) {
      console.error('❌ Failed to start trading loop:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Trading loop not running');
      return;
    }

    try {
      await this.mainEngine.stop();
      this.isRunning = false;
      console.log('✅ TRADING LOOP STOPPED');
    } catch (error) {
      console.error('❌ Error stopping trading loop:', error);
      throw error;
    }
  }
}
