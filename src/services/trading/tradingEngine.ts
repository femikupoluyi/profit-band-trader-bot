
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { CredentialsManager } from './credentialsManager';
import { ServiceInitializer } from './serviceInitializer';
import { LoopManager } from './loopManager';

export class TradingEngine {
  private userId: string;
  private config: TradingConfigData;
  private credentialsManager: CredentialsManager;
  private serviceInitializer: ServiceInitializer;
  private loopManager: LoopManager;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
    this.credentialsManager = new CredentialsManager(userId);
    this.serviceInitializer = new ServiceInitializer(userId, config);
    this.loopManager = new LoopManager(userId, config);
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing trading engine for user:', this.userId);
      
      const bybitService = await this.credentialsManager.fetchCredentials();
      
      if (bybitService) {
        const services = this.serviceInitializer.initializeServices(bybitService);
        this.loopManager.setServices(services);
      }
    } catch (error) {
      console.error('Error initializing trading engine:', error);
      await this.logActivity('error', 'Failed to initialize trading engine', { error: error.message });
    }
  }

  async start(): Promise<void> {
    this.loopManager.start();
  }

  async stop(): Promise<void> {
    this.loopManager.stop();
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await (supabase as any)
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
