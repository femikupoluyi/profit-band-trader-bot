
import { TradingConfigManager, TradingConfig } from '../config/TradingConfigManager';
import { PositionMonitorService } from './PositionMonitorService';
import { MarketDataScannerService } from './MarketDataScannerService';
import { SignalAnalysisService } from './SignalAnalysisService';
import { SignalExecutionService } from './SignalExecutionService';
import { EndOfDayManagerService } from './EndOfDayManagerService';
import { BybitService } from '../../bybitService';
import { supabase } from '@/integrations/supabase/client';

export class MainTradingEngine {
  private userId: string;
  private configManager: TradingConfigManager;
  private bybitService: BybitService;
  private isRunning = false;
  private mainLoopInterval: NodeJS.Timeout | null = null;
  
  // Core Services
  private positionMonitor: PositionMonitorService;
  private marketScanner: MarketDataScannerService;
  private signalAnalyzer: SignalAnalysisService;
  private signalExecutor: SignalExecutionService;
  private eodManager: EndOfDayManagerService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.configManager = TradingConfigManager.getInstance(userId);
    
    // Initialize services (they will get config on each cycle)
    this.positionMonitor = new PositionMonitorService(userId, bybitService);
    this.marketScanner = new MarketDataScannerService(userId, bybitService);
    this.signalAnalyzer = new SignalAnalysisService(userId);
    this.signalExecutor = new SignalExecutionService(userId, bybitService);
    this.eodManager = new EndOfDayManagerService(userId, bybitService);
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing Main Trading Engine...');
      
      // Load initial configuration
      await this.configManager.loadConfig();
      
      console.log('✅ Main Trading Engine initialized successfully');
      await this.logActivity('system_info', 'Main Trading Engine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Main Trading Engine:', error);
      await this.logActivity('system_error', 'Failed to initialize Main Trading Engine', { error: error.message });
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Trading engine is already running');
      return;
    }

    try {
      const config = await this.configManager.refreshConfig();
      
      if (!config.is_active) {
        console.log('❌ Cannot start trading: configuration is not active');
        await this.logActivity('system_error', 'Cannot start trading: configuration is not active');
        return;
      }

      this.isRunning = true;
      
      console.log(`🚀 Starting Main Trading Loop with ${config.main_loop_interval_seconds}s interval`);
      await this.logActivity('system_info', `Trading started with ${config.main_loop_interval_seconds}s interval`);

      // Start the main loop
      this.scheduleMainLoop(config.main_loop_interval_seconds);
      
    } catch (error) {
      console.error('❌ Failed to start trading engine:', error);
      await this.logActivity('system_error', 'Failed to start trading engine', { error: error.message });
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Trading engine is not running');
      return;
    }

    console.log('🛑 Stopping Main Trading Engine...');
    this.isRunning = false;
    
    if (this.mainLoopInterval) {
      clearTimeout(this.mainLoopInterval);
      this.mainLoopInterval = null;
    }

    await this.logActivity('system_info', 'Trading engine stopped');
    console.log('✅ Main Trading Engine stopped');
  }

  private scheduleMainLoop(intervalSeconds: number): void {
    if (!this.isRunning) return;

    this.mainLoopInterval = setTimeout(async () => {
      try {
        await this.executeMainTradingLoop();
        
        // Schedule next iteration if still running
        if (this.isRunning) {
          const currentConfig = await this.configManager.refreshConfig();
          this.scheduleMainLoop(currentConfig.main_loop_interval_seconds);
        }
      } catch (error) {
        console.error('❌ Error in main trading loop:', error);
        await this.logActivity('system_error', 'Main trading loop error', { error: error.message });
        
        // Continue running but log the error
        if (this.isRunning) {
          const currentConfig = this.configManager.getConfig();
          this.scheduleMainLoop(currentConfig.main_loop_interval_seconds);
        }
      }
    }, intervalSeconds * 1000);
  }

  private async executeMainTradingLoop(): Promise<void> {
    console.log('\n🔄 === MAIN TRADING LOOP CYCLE START ===');
    
    try {
      // Always refresh config at start of each cycle
      const config = await this.configManager.refreshConfig();
      
      if (!config.is_active) {
        console.log('⏸️ Trading is not active, skipping cycle');
        return;
      }

      console.log(`📊 Cycle config: ${config.trading_pairs.length} pairs, ${config.main_loop_interval_seconds}s interval`);

      // 2.1 Position Monitoring & Order Fills
      console.log('\n📊 Step 1: Position Monitoring & Order Fills');
      await this.positionMonitor.checkOrderFills(config);

      // 2.2 Market Data Scanning  
      console.log('\n📈 Step 2: Market Data Scanning');
      await this.marketScanner.scanMarkets(config);

      // 2.3 Signal Analysis
      console.log('\n🔍 Step 3: Signal Analysis');
      await this.signalAnalyzer.analyzeSignals(config);

      // 2.4 Signal Execution
      console.log('\n⚡ Step 4: Signal Execution');
      await this.signalExecutor.executeSignals(config);

      // 2.5 End-of-Day Management
      console.log('\n🌅 Step 5: End-of-Day Management');
      await this.eodManager.manageEndOfDay(config);

      console.log('✅ === MAIN TRADING LOOP CYCLE COMPLETE ===\n');
      
    } catch (error) {
      console.error('❌ Error in main trading loop cycle:', error);
      throw error;
    }
  }

  isEngineRunning(): boolean {
    return this.isRunning;
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
