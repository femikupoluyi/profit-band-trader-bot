
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
  private isInitialized = false;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
    this.credentialsManager = new CredentialsManager(userId);
    this.serviceInitializer = new ServiceInitializer(userId, config);
    this.loopManager = new LoopManager(userId, config);
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing trading engine for user:', this.userId);
      
      const bybitService = await this.credentialsManager.fetchCredentials();
      
      if (bybitService) {
        console.log('BybitService initialized successfully, setting up trading services...');
        const services = this.serviceInitializer.initializeServices(bybitService);
        this.loopManager.setServices(services);
        this.isInitialized = true;
        await this.logActivity('info', 'Trading engine initialized successfully');
        return true;
      } else {
        console.log('Failed to initialize BybitService - no valid credentials');
        await this.logActivity('error', 'Failed to initialize trading engine - API credentials not configured or invalid');
        this.isInitialized = false;
        return false;
      }
    } catch (error) {
      console.error('Error initializing trading engine:', error);
      await this.logActivity('error', 'Failed to initialize trading engine', { error: error.message });
      this.isInitialized = false;
      return false;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        console.log('Cannot start trading - engine not initialized');
        return;
      }
    }
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
