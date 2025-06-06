
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
import { TransactionReconciliationService } from './TransactionReconciliationService';
import { TradingEngineInitializer } from './engine/TradingEngineInitializer';
import { TradingEngineLifecycle } from './engine/TradingEngineLifecycle';

export class MainTradingEngine {
  private userId: string;
  private configManager: TradingConfigManager;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private scheduler: TradingLoopScheduler;
  private cycleExecutor: TradingCycleExecutor;
  private reconciliationService: TransactionReconciliationService;
  private initializer: TradingEngineInitializer;
  private lifecycle: TradingEngineLifecycle;
  
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

    // Initialize engine components
    this.initializer = new TradingEngineInitializer(userId, this.configManager, this.logger);
    this.lifecycle = new TradingEngineLifecycle(
      userId,
      this.configManager,
      this.scheduler,
      this.cycleExecutor,
      this.reconciliationService,
      this.logger
    );
  }

  async initialize(): Promise<void> {
    return this.initializer.initialize();
  }

  async start(): Promise<void> {
    return this.lifecycle.start();
  }

  async stop(): Promise<void> {
    return this.lifecycle.stop();
  }

  async manualClosePosition(tradeId: string): Promise<{ success: boolean; message: string; data?: any }> {
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
    return this.lifecycle.isRunning();
  }
}
