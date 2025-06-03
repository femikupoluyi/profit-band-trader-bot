
import { TradingEngine } from './trading/tradingEngine';
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

class TradingManager {
  private static instance: TradingManager;
  private engines: Map<string, TradingEngine> = new Map();
  private manuallyStoppedUsers: Set<string> = new Set(); // Track manually stopped users

  private constructor() {}

  static getInstance(): TradingManager {
    if (!TradingManager.instance) {
      TradingManager.instance = new TradingManager();
    }
    return TradingManager.instance;
  }

  async startTradingForUser(userId: string): Promise<void> {
    try {
      // Check if already running
      if (this.engines.has(userId)) {
        console.log(`Trading already running for user ${userId}`);
        return;
      }

      // Remove from manually stopped list when explicitly starting
      this.manuallyStoppedUsers.delete(userId);

      // Get user's trading config
      const { data: config, error } = await (supabase as any)
        .from('trading_configs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error || !config) {
        console.log(`No active trading config found for user ${userId}`);
        return;
      }

      // Create and start trading engine
      const engine = new TradingEngine(userId, config);
      await engine.initialize();
      await engine.start();

      this.engines.set(userId, engine);
      console.log(`Trading started for user ${userId}`);
    } catch (error) {
      console.error(`Error starting trading for user ${userId}:`, error);
    }
  }

  async stopTradingForUser(userId: string): Promise<void> {
    const engine = this.engines.get(userId);
    if (engine) {
      await engine.stop();
      this.engines.delete(userId);
      // Mark as manually stopped to prevent auto-restart
      this.manuallyStoppedUsers.add(userId);
      console.log(`Trading stopped for user ${userId} (manually stopped)`);
    }
  }

  async restartTradingForUser(userId: string): Promise<void> {
    await this.stopTradingForUser(userId);
    // Remove from manually stopped when restarting
    this.manuallyStoppedUsers.delete(userId);
    await this.startTradingForUser(userId);
  }

  isRunningForUser(userId: string): boolean {
    return this.engines.has(userId);
  }

  async checkAllActiveConfigs(): Promise<void> {
    try {
      const { data: activeConfigs } = await (supabase as any)
        .from('trading_configs')
        .select('user_id')
        .eq('is_active', true);

      if (activeConfigs) {
        for (const config of activeConfigs) {
          // Skip users who were manually stopped
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
  }, 5000); // Wait 5 seconds after app load
}
