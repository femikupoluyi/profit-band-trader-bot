
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { CredentialsManager } from './credentialsManager';
import { MainTradingEngine } from './core/MainTradingEngine';

export class TradingEngine {
  private userId: string;
  private config: TradingConfigData;
  private credentialsManager: CredentialsManager;
  private mainEngine: MainTradingEngine | null = null;
  private isInitialized = false;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
    this.credentialsManager = new CredentialsManager(userId);
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 Initializing Trading Engine for user:', this.userId);
      
      const bybitService = await this.credentialsManager.fetchCredentials();
      
      if (bybitService) {
        console.log('✅ BybitService initialized, creating Main Trading Engine...');
        this.mainEngine = new MainTradingEngine(this.userId, this.config);
        await this.mainEngine.initialize();
        this.isInitialized = true;
        await this.logActivity('system_info', 'Trading Engine initialized successfully');
        return true;
      } else {
        console.log('❌ Failed to initialize BybitService - no valid credentials');
        await this.logActivity('system_error', 'Failed to initialize Trading Engine - API credentials not configured or invalid');
        this.isInitialized = false;
        return false;
      }
    } catch (error) {
      console.error('❌ Error initializing Trading Engine:', error);
      await this.logActivity('system_error', 'Failed to initialize Trading Engine', { error: error.message });
      this.isInitialized = false;
      return false;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        console.log('❌ Cannot start trading - engine not initialized');
        return;
      }
    }

    if (this.mainEngine) {
      await this.mainEngine.start();
    }
  }

  async stop(): Promise<void> {
    if (this.mainEngine) {
      await this.mainEngine.stop();
    }
  }

  isRunning(): boolean {
    return this.mainEngine ? this.mainEngine.isEngineRunning() : false;
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: type,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
