
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SignalExecutionService } from './SignalExecutionService';
import { PositionMonitorService } from './PositionMonitorService';
import { TransactionReconciliationService } from './TransactionReconciliationService';
import { PositionSyncService } from './PositionSyncService';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { InstrumentCache } from './InstrumentCache';
import { ConfigurableFormatter } from './ConfigurableFormatter';

export class MainTradingEngine {
  private userId: string;
  private config: TradingConfigData;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private signalExecutionService: SignalExecutionService;
  private positionMonitorService: PositionMonitorService;
  private reconciliationService: TransactionReconciliationService;
  private positionSyncService: PositionSyncService;
  private mainLoopInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
    this.bybitService = new BybitService('', '', true); // Will be initialized with proper credentials
    this.logger = new TradingLogger(userId);
    
    // Initialize services
    this.signalExecutionService = new SignalExecutionService(userId, this.bybitService);
    this.positionMonitorService = new PositionMonitorService(userId, this.bybitService);
    this.reconciliationService = new TransactionReconciliationService(userId, this.bybitService);
    this.positionSyncService = new PositionSyncService(userId, this.bybitService);
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🔧 Initializing MainTradingEngine...');
      await this.logger.logSuccess('MainTradingEngine initialization started');

      // Clear all trading caches on startup
      console.log('🧹 Clearing trading caches on startup...');
      InstrumentCache.clearAllTradingCache();
      ConfigurableFormatter.clearAllTradingCache();

      // Get proper credentials and reinitialize BybitService
      const { CredentialsManager } = await import('../credentialsManager');
      const credentialsManager = new CredentialsManager(this.userId);
      const bybitServiceWithCredentials = await credentialsManager.fetchCredentials();
      
      if (!bybitServiceWithCredentials) {
        throw new Error('Failed to get Bybit credentials');
      }
      
      this.bybitService = bybitServiceWithCredentials;
      
      // Reinitialize services with proper credentials
      this.signalExecutionService = new SignalExecutionService(this.userId, this.bybitService);
      this.positionMonitorService = new PositionMonitorService(this.userId, this.bybitService);
      this.reconciliationService = new TransactionReconciliationService(this.userId, this.bybitService);
      this.positionSyncService = new PositionSyncService(this.userId, this.bybitService);

      // Perform startup position sync to fix any discrepancies
      console.log('🔄 Performing startup position synchronization...');
      await this.positionSyncService.performStartupSync();

      // Perform startup reconciliation
      await this.reconciliationService.performStartupReconciliation();

      console.log('✅ MainTradingEngine initialized successfully');
      await this.logger.logSuccess('MainTradingEngine initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize MainTradingEngine:', error);
      await this.logger.logError('MainTradingEngine initialization failed', error);
      return false;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ MainTradingEngine is already running');
      return;
    }

    try {
      console.log('🚀 Starting MainTradingEngine...');
      await this.logger.logSuccess('MainTradingEngine starting');
      
      this.isRunning = true;
      
      // Start the main trading loop
      await this.startMainLoop();
      
      console.log('✅ MainTradingEngine started successfully');
      await this.logger.logSuccess('MainTradingEngine started successfully');
      
    } catch (error) {
      console.error('❌ Error starting MainTradingEngine:', error);
      await this.logger.logError('Failed to start MainTradingEngine', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      console.log('🛑 Stopping MainTradingEngine...');
      await this.logger.logSuccess('MainTradingEngine stopping');
      
      this.isRunning = false;
      
      if (this.mainLoopInterval) {
        clearInterval(this.mainLoopInterval);
        this.mainLoopInterval = null;
      }
      
      console.log('✅ MainTradingEngine stopped successfully');
      await this.logger.logSuccess('MainTradingEngine stopped successfully');
      
    } catch (error) {
      console.error('❌ Error stopping MainTradingEngine:', error);
      await this.logger.logError('Failed to stop MainTradingEngine', error);
      throw error;
    }
  }

  private async startMainLoop(): Promise<void> {
    const intervalMs = (this.config.main_loop_interval_seconds || 30) * 1000;
    console.log(`⏰ Starting main loop with ${intervalMs / 1000}s interval`);

    // Run immediately
    await this.executeMainLoop();

    // Then run on interval
    this.mainLoopInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.executeMainLoop();
      }
    }, intervalMs);
  }

  private async executeMainLoop(): Promise<void> {
    try {
      console.log('\n🔄 ===== MAIN LOOP EXECUTION START =====');
      
      // 1. Sync positions with exchange first
      await this.positionSyncService.syncAllPositionsWithExchange();
      
      // 2. Execute signals
      await this.signalExecutionService.executeSignal(this.config);
      
      // 3. Monitor and check order fills
      await this.positionMonitorService.checkOrderFills(this.config);
      
      // 4. Reconcile transactions every few loops
      if (Math.random() < 0.1) { // 10% chance each loop
        await this.reconciliationService.reconcileWithBybitHistory(6); // 6 hours lookback
      }
      
      console.log('✅ ===== MAIN LOOP EXECUTION COMPLETE =====\n');
      
    } catch (error) {
      console.error('❌ Error in main loop execution:', error);
      await this.logger.logError('Main loop execution failed', error);
    }
  }

  isEngineRunning(): boolean {
    return this.isRunning;
  }

  updateConfig(newConfig: TradingConfigData): void {
    this.config = newConfig;
    console.log('📋 Trading configuration updated');
  }
}
