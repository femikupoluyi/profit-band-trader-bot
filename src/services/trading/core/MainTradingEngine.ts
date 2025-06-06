import { TradingConfigManager } from '../config/TradingConfigManager';
import { PositionMonitorService } from './PositionMonitorService';
import { MarketDataScannerService } from './MarketDataScannerService';
import { SignalAnalysisService } from './SignalAnalysisService';
import { SignalExecutionService } from './SignalExecutionService';
import { EndOfDayManagerService } from './EndOfDayManagerService';
import { ManualCloseService } from './ManualCloseService';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { ConfigConverter } from './ConfigConverter';
import { TradingLoopScheduler } from './TradingLoopScheduler';
import { TradingCycleExecutor } from './TradingCycleExecutor';
import { ConfigurableFormatter } from './ConfigurableFormatter';
import { TransactionReconciliationService } from './TransactionReconciliationService';

export class MainTradingEngine {
  private userId: string;
  private configManager: TradingConfigManager;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private scheduler: TradingLoopScheduler;
  private cycleExecutor: TradingCycleExecutor;
  private reconciliationService: TransactionReconciliationService;
  
  // Core Services
  private positionMonitor: PositionMonitorService;
  private marketScanner: MarketDataScannerService;
  private signalAnalysisService: SignalAnalysisService;
  private signalExecutor: SignalExecutionService;
  private eodManager: EndOfDayManagerService;
  private manualCloseService: ManualCloseService;

  constructor(userId: string, bybitService: BybitService) {
    if (!userId) {
      throw new Error('UserId is required for MainTradingEngine');
    }
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.configManager = TradingConfigManager.getInstance(userId);
    this.scheduler = new TradingLoopScheduler(userId);
    
    // Set logger on bybit service
    this.bybitService.setLogger(this.logger);
    
    // Initialize services
    this.positionMonitor = new PositionMonitorService(userId, bybitService);
    this.marketScanner = new MarketDataScannerService(userId, bybitService);
    this.signalAnalysisService = new SignalAnalysisService(userId, bybitService);
    this.signalExecutor = new SignalExecutionService(userId, bybitService);
    this.eodManager = new EndOfDayManagerService(userId, bybitService);
    this.manualCloseService = new ManualCloseService(userId, bybitService);

    // Initialize cycle executor
    this.cycleExecutor = new TradingCycleExecutor(
      userId,
      this.positionMonitor,
      this.marketScanner,
      this.signalAnalysisService,
      this.signalExecutor,
      this.eodManager
    );

    // Initialize reconciliation service
    this.reconciliationService = new TransactionReconciliationService(userId, bybitService);
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing Main Trading Engine...');
      
      // Load initial configuration
      await this.configManager.loadConfig();
      const config = this.configManager.getConfig();
      const configData = ConfigConverter.convertConfig(config);
      
      // Initialize ConfigurableFormatter with current config
      ConfigurableFormatter.setConfig(configData);
      
      console.log('✅ Main Trading Engine initialized successfully');
      await this.logger.logSuccess('Main Trading Engine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Main Trading Engine:', error);
      await this.logger.logError('Failed to initialize Main Trading Engine', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.scheduler.isSchedulerRunning()) {
      console.log('⚠️ Trading engine is already running');
      return;
    }

    try {
      const config = await this.configManager.refreshConfig();
      
      if (!config.is_active) {
        console.log('❌ Cannot start trading: configuration is not active');
        await this.logger.logError('Cannot start trading: configuration is not active', new Error('Config not active'));
        return;
      }

      // Perform startup reconciliation with Bybit
      console.log('🔄 Performing startup reconciliation...');
      await this.reconciliationService.performStartupReconciliation();

      // Update ConfigurableFormatter with latest config
      const configData = ConfigConverter.convertConfig(config);
      ConfigurableFormatter.setConfig(configData);

      console.log(`🚀 Starting Main Trading Loop with ${config.main_loop_interval_seconds}s interval`);
      await this.logger.logSuccess(`Trading started with ${config.main_loop_interval_seconds}s interval`);

      // Start the main loop using scheduler
      this.scheduler.start(config.main_loop_interval_seconds, async () => {
        const currentConfig = await this.configManager.refreshConfig();
        
        if (!currentConfig.is_active) {
          console.log('⏸️ Trading is not active, skipping cycle');
          return;
        }

        const configData = ConfigConverter.convertConfig(currentConfig);
        await this.cycleExecutor.executeTradingCycle(configData);
      });
      
    } catch (error) {
      console.error('❌ Failed to start trading engine:', error);
      await this.logger.logError('Failed to start trading engine', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.scheduler.isSchedulerRunning()) {
      console.log('⚠️ Trading engine is not running');
      return;
    }

    console.log('🛑 Stopping Main Trading Engine...');
    this.scheduler.stop();

    await this.logger.logSuccess('Trading engine stopped');
    console.log('✅ Main Trading Engine stopped');
  }

  async manualClosePosition(tradeId: string): Promise<void> {
    if (!tradeId || typeof tradeId !== 'string') {
      throw new Error('Valid tradeId is required for manual close');
    }
    return this.manualCloseService.closePosition(tradeId);
  }

  async simulateEndOfDay(): Promise<void> {
    try {
      console.log('🌅 Manual End-of-Day Simulation Started...');
      await this.logger.logSuccess('Manual end-of-day simulation started');
      
      // Get current config - load fresh config for EOD simulation
      await this.configManager.loadConfig();
      const config = this.configManager.getConfig();
      const configData = ConfigConverter.convertConfig(config);
      
      console.log('📋 EOD Config loaded:', {
        autoCloseAtEOD: configData.auto_close_at_end_of_day,
        eodCloseThreshold: configData.eod_close_premium_percent
      });
      
      // Force EOD execution regardless of time by temporarily overriding the config
      const eodConfigData = {
        ...configData,
        auto_close_at_end_of_day: true // Force enable for manual simulation
      };
      
      // Execute end-of-day management with force simulation flag
      await this.eodManager.manageEndOfDay(eodConfigData, true);
      
      console.log('✅ Manual End-of-Day Simulation Completed');
      await this.logger.log('position_closed', 'Manual end-of-day simulation completed successfully');
    } catch (error) {
      console.error('❌ Error in manual end-of-day simulation:', error);
      await this.logger.logError('Manual end-of-day simulation failed', error);
      throw error;
    }
  }

  async performTransactionReconciliation(): Promise<void> {
    try {
      console.log('🔄 Manual Transaction Reconciliation Started...');
      await this.logger.logSuccess('Manual transaction reconciliation started');
      
      await this.reconciliationService.reconcileWithBybitHistory(24);
      
      console.log('✅ Manual Transaction Reconciliation Completed');
      await this.logger.logSuccess('Manual transaction reconciliation completed');
    } catch (error) {
      console.error('❌ Error in manual transaction reconciliation:', error);
      await this.logger.logError('Manual transaction reconciliation failed', error);
      throw error;
    }
  }

  isEngineRunning(): boolean {
    return this.scheduler.isSchedulerRunning();
  }
}
