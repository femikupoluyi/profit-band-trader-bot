
import { TradingConfigManager } from '../../config/TradingConfigManager';
import { TradingLoopScheduler } from '../TradingLoopScheduler';
import { TradingCycleExecutor } from '../TradingCycleExecutor';
import { TransactionReconciliationService } from '../TransactionReconciliationService';
import { ConfigConverter } from '../ConfigConverter';
import { ConfigurableFormatter } from '../ConfigurableFormatter';
import { TradingLogger } from '../TradingLogger';

export class TradingEngineLifecycle {
  private userId: string;
  private configManager: TradingConfigManager;
  private scheduler: TradingLoopScheduler;
  private cycleExecutor: TradingCycleExecutor;
  private reconciliationService: TransactionReconciliationService;
  private logger: TradingLogger;

  constructor(
    userId: string,
    configManager: TradingConfigManager,
    scheduler: TradingLoopScheduler,
    cycleExecutor: TradingCycleExecutor,
    reconciliationService: TransactionReconciliationService,
    logger: TradingLogger
  ) {
    this.userId = userId;
    this.configManager = configManager;
    this.scheduler = scheduler;
    this.cycleExecutor = cycleExecutor;
    this.reconciliationService = reconciliationService;
    this.logger = logger;
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

    console.log('🛑 Stopping Trading Engine...');
    this.scheduler.stop();

    await this.logger.logSuccess('Trading engine stopped');
    console.log('✅ Trading Engine stopped');
  }

  isRunning(): boolean {
    return this.scheduler.isSchedulerRunning();
  }
}
