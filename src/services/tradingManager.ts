
import { TradingEngine } from './trading/tradingEngine';
import { supabase } from '@/integrations/supabase/client';

class TradingManager {
  private static instance: TradingManager;
  private engines: Map<string, TradingEngine> = new Map();
  private manuallyStoppedUsers: Set<string> = new Set();

  private constructor() {}

  static getInstance(): TradingManager {
    if (!TradingManager.instance) {
      TradingManager.instance = new TradingManager();
    }
    return TradingManager.instance;
  }

  async startTradingForUser(userId: string): Promise<void> {
    try {
      if (this.engines.has(userId)) {
        console.log(`Trading already running for user ${userId}`);
        return;
      }

      this.manuallyStoppedUsers.delete(userId);

      // Get user's trading config
      const { data: config, error } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error || !config) {
        console.log(`No active trading config found for user ${userId}`);
        return;
      }

      console.log('🚀 Starting new limit-only trading engine...');
      
      // Create and start new trading engine
      const engine = new TradingEngine(userId, config);
      await engine.initialize();
      await engine.start();

      this.engines.set(userId, engine);
      console.log(`✅ Limit-only trading started for user ${userId}`);
    } catch (error) {
      console.error(`❌ Error starting trading for user ${userId}:`, error);
    }
  }

  async stopTradingForUser(userId: string): Promise<void> {
    const engine = this.engines.get(userId);
    if (engine) {
      await engine.stop();
      this.engines.delete(userId);
      this.manuallyStoppedUsers.add(userId);
      console.log(`✅ Trading stopped for user ${userId} (manually stopped)`);
    }
  }

  async restartTradingForUser(userId: string): Promise<void> {
    await this.stopTradingForUser(userId);
    this.manuallyStoppedUsers.delete(userId);
    await this.startTradingForUser(userId);
  }

  isRunningForUser(userId: string): boolean {
    const engine = this.engines.get(userId);
    return engine ? engine.isRunning() : false;
  }

  async checkAllActiveConfigs(): Promise<void> {
    try {
      const { data: activeConfigs } = await supabase
        .from('trading_configs')
        .select('user_id')
        .eq('is_active', true);

      if (activeConfigs) {
        for (const config of activeConfigs) {
          if (this.manuallyStoppedUsers.has(config.user_id)) {
            console.log(`Skipping auto-start for manually stopped user: ${config.user_id}`);
            continue;
          }

          if (!this.isRunningForUser(config.user_id)) {
            await this.startTradingForUser(config.user_id);
          }
        }
      }
    } catch (error) {
      console.error('Error checking active configs:', error);
    }
  }
}

export const tradingManager = TradingManager.getInstance();

// Auto-start trading for active users when the app loads
if (typeof window !== 'undefined') {
  setTimeout(() => {
    tradingManager.checkAllActiveConfigs();
  }, 5000);
}
