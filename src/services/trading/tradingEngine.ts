import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { MarketScanner } from './marketScanner';
import { SignalAnalyzer } from './signalAnalyzer';
import { TradeExecutor } from './tradeExecutor';
import { PositionMonitor } from './positionMonitor';
import { ApiCredentials } from './types';

export class TradingEngine {
  private userId: string;
  private config: TradingConfigData;
  private bybitService: BybitService | null = null;
  private isRunning = false;
  private loopCount = 0;
  private lastEndOfDayCheck = '';
  
  // Service instances
  private marketScanner: MarketScanner | null = null;
  private signalAnalyzer: SignalAnalyzer | null = null;
  private tradeExecutor: TradeExecutor | null = null;
  private positionMonitor: PositionMonitor | null = null;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing trading engine for user:', this.userId);
      
      // Fetch API credentials with better error handling
      const { data: credentials, error } = await (supabase as any)
        .from('api_credentials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('exchange_name', 'bybit')
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No active API credentials found for user:', this.userId);
          await this.logActivity('error', 'No active API credentials found. Please configure your Bybit API credentials in the API Setup tab.');
        } else {
          console.error('Error fetching credentials:', error);
          await this.logActivity('error', `Error fetching API credentials: ${error.message}`);
        }
        return;
      }

      if (credentials) {
        console.log('Found API credentials for Bybit, testnet:', credentials.testnet);
        await this.logActivity('info', `Found API credentials for Bybit (testnet: ${credentials.testnet})`);
        
        this.bybitService = new BybitService({
          apiKey: credentials.apiKey,
          apiSecret: credentials.api_secret,
          testnet: credentials.testnet,
        });

        // Initialize all services with config
        this.marketScanner = new MarketScanner(this.userId, this.bybitService, this.config);
        this.signalAnalyzer = new SignalAnalyzer(this.userId, this.config);
        this.tradeExecutor = new TradeExecutor(this.userId, this.config, this.bybitService);
        this.positionMonitor = new PositionMonitor(this.userId, this.bybitService);
        
        // Test the connection
        try {
          const balance = await this.bybitService.getAccountBalance();
          if (balance.retCode === 0) {
            console.log('API connection test successful');
            await this.logActivity('info', 'API connection established successfully', { 
              testnet: credentials.testnet,
              balance: balance.result ? 'Available' : 'No balance data'
            });
          } else {
            console.log('API connection test failed:', balance);
            await this.logActivity('error', 'API connection test failed', { 
              retCode: balance.retCode, 
              retMsg: balance.retMsg 
            });
          }
        } catch (error) {
          console.log('API connection test failed:', error);
          await this.logActivity('error', 'API connection failed', { error: error.message });
        }
      }
    } catch (error) {
      console.error('Error initializing trading engine:', error);
      await this.logActivity('error', 'Failed to initialize trading engine', { error: error.message });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.loopCount = 0;
    await this.logActivity('info', 'Trading engine started with new strategy');
    console.log('Trading engine started with support line strategy, beginning main loop...');
    
    // Main trading loop
    this.tradingLoop();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.logActivity('info', 'Trading engine stopped');
    console.log('Trading engine stopped');
  }

  private async tradingLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        this.loopCount++;
        console.log(`Trading loop iteration #${this.loopCount}`);

        if (!this.bybitService || !this.marketScanner || !this.signalAnalyzer || !this.tradeExecutor || !this.positionMonitor) {
          console.log('Services not initialized, attempting to initialize...');
          await this.logActivity('warning', 'Trading engine running without proper initialization. Attempting to reconnect...');
          await this.initialize();
          if (!this.bybitService) {
            console.log('Still no services initialized, waiting 60 seconds...');
            await this.logActivity('warning', 'No API credentials available. Please configure in API Setup tab. Retrying in 60 seconds...');
            await this.sleep(60000);
            continue;
          }
        }

        // Check for end-of-day processing
        await this.checkEndOfDay();

        console.log('Scanning markets...');
        await this.marketScanner.scanMarkets();
        
        console.log('Analyzing markets and creating signals...');
        await this.signalAnalyzer.analyzeAndCreateSignals();
        
        console.log('Processing signals...');
        await this.tradeExecutor.processSignals();
        
        console.log('Monitoring positions...');
        await this.positionMonitor.monitorPositions();
        
        console.log(`Loop #${this.loopCount} complete, waiting 30 seconds...`);
        await this.logActivity('info', `Trading loop #${this.loopCount} completed successfully`);
        
        // Wait before next iteration
        await this.sleep(30000); // 30 seconds
      } catch (error) {
        console.error('Error in trading loop:', error);
        await this.logActivity('error', 'Trading loop error', { error: error.message, loopCount: this.loopCount });
        await this.sleep(60000); // Wait 1 minute on error
      }
    }
  }

  private async checkEndOfDay(): Promise<void> {
    try {
      const now = new Date();
      const resetTime = this.config.daily_reset_time || '00:00:00';
      const [hours, minutes] = resetTime.split(':').map(Number);
      
      const resetDateTime = new Date(now);
      resetDateTime.setHours(hours, minutes, 0, 0);
      
      // If we've passed the reset time today and haven't processed it yet
      const todayKey = now.toDateString();
      if (now >= resetDateTime && this.lastEndOfDayCheck !== todayKey) {
        console.log('Performing end-of-day processing...');
        await this.logActivity('info', 'Starting end-of-day processing');
        
        if (this.tradeExecutor) {
          await this.tradeExecutor.closeEndOfDayTrades();
        }
        
        this.lastEndOfDayCheck = todayKey;
        await this.logActivity('info', 'End-of-day processing completed');
      }
    } catch (error) {
      console.error('Error in end-of-day check:', error);
      await this.logActivity('error', 'End-of-day processing failed', { error: error.message });
    }
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
