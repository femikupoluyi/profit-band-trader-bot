import { TradingConfigManager, TradingConfig } from '../config/TradingConfigManager';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { PositionMonitorService } from './PositionMonitorService';
import { MarketDataScannerService } from './MarketDataScannerService';
import { SignalAnalysisService } from './SignalAnalysisService';
import { SignalExecutionService } from './SignalExecutionService';
import { EndOfDayManagerService } from './EndOfDayManagerService';
import { ManualCloseService } from './ManualCloseService';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';

export class MainTradingEngine {
  private userId: string;
  private configManager: TradingConfigManager;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private isRunning = false;
  private mainLoopInterval: NodeJS.Timeout | null = null;
  
  // Core Services
  private positionMonitor: PositionMonitorService;
  private marketScanner: MarketDataScannerService;
  private signalAnalysisService: SignalAnalysisService;
  private signalExecutor: SignalExecutionService;
  private eodManager: EndOfDayManagerService;
  private manualCloseService: ManualCloseService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.configManager = TradingConfigManager.getInstance(userId);
    
    // Set logger on bybit service
    this.bybitService.setLogger(this.logger);
    
    // Initialize services (they will get config on each cycle)
    this.positionMonitor = new PositionMonitorService(userId, bybitService);
    this.marketScanner = new MarketDataScannerService(userId, bybitService);
    this.signalAnalysisService = new SignalAnalysisService(userId, bybitService);
    this.signalExecutor = new SignalExecutionService(userId, bybitService);
    this.eodManager = new EndOfDayManagerService(userId, bybitService);
    this.manualCloseService = new ManualCloseService(userId, bybitService);
  }

  // Convert TradingConfig to TradingConfigData with correct field mapping
  private convertConfig(config: TradingConfig): TradingConfigData {
    return {
      max_active_pairs: config.maximum_active_pairs || 5,
      max_order_amount_usd: config.maximum_order_amount_usd || 100,
      max_portfolio_exposure_percent: 25.0, // Default value not in TradingConfig
      daily_reset_time: '00:00:00', // Default value not in TradingConfig
      chart_timeframe: config.chart_timeframe || '4h',
      entry_offset_percent: config.entry_above_support_percentage || 0.5,
      take_profit_percent: config.take_profit_percentage || 1.0,
      support_candle_count: config.support_analysis_candles || 128,
      max_positions_per_pair: config.maximum_positions_per_pair || 2,
      new_support_threshold_percent: 1.0, // Default value not in TradingConfig
      trading_pairs: config.trading_pairs || ['BTCUSDT', 'ETHUSDT'],
      is_active: config.is_active || false,
      main_loop_interval_seconds: config.main_loop_interval_seconds || 30,
      auto_close_at_end_of_day: config.auto_close_at_end_of_day || false,
      eod_close_premium_percent: config.eod_close_premium_percentage || 0.1,
      manual_close_premium_percent: config.manual_close_premium_percentage || 0.1,
      support_lower_bound_percent: config.support_lower_bound_percentage || 5.0,
      support_upper_bound_percent: config.support_upper_bound_percentage || 2.0,
      minimum_notional_per_symbol: { 'BTCUSDT': 10, 'ETHUSDT': 10 },
      quantity_increment_per_symbol: { 'BTCUSDT': 0.00001, 'ETHUSDT': 0.0001 }
    };
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing Main Trading Engine...');
      
      // Load initial configuration
      await this.configManager.loadConfig();
      
      console.log('✅ Main Trading Engine initialized successfully');
      await this.logger.logSuccess('Main Trading Engine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Main Trading Engine:', error);
      await this.logger.logError('Failed to initialize Main Trading Engine', error);
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
        await this.logger.logError('Cannot start trading: configuration is not active', new Error('Config not active'));
        return;
      }

      this.isRunning = true;
      
      console.log(`🚀 Starting Main Trading Loop with ${config.main_loop_interval_seconds}s interval`);
      await this.logger.logSuccess(`Trading started with ${config.main_loop_interval_seconds}s interval`);

      // Start the main loop
      this.scheduleMainLoop(config.main_loop_interval_seconds);
      
    } catch (error) {
      console.error('❌ Failed to start trading engine:', error);
      await this.logger.logError('Failed to start trading engine', error);
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

    await this.logger.logSuccess('Trading engine stopped');
    console.log('✅ Main Trading Engine stopped');
  }

  async manualClosePosition(tradeId: string): Promise<void> {
    return this.manualCloseService.closePosition(tradeId);
  }

  async simulateEndOfDay(): Promise<void> {
    try {
      console.log('🌅 Manual End-of-Day Simulation Started...');
      await this.logger.logSuccess('Manual end-of-day simulation started');
      
      // Get current config - load fresh config for EOD simulation
      await this.configManager.loadConfig();
      const config = this.configManager.getConfig();
      const configData = this.convertConfig(config);
      
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
        await this.logger.logError('Main trading loop error', error);
        
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

      // Convert config to TradingConfigData format
      const configData = this.convertConfig(config);

      // 2.1 Position Monitoring & Order Fills
      console.log('\n📊 Step 1: Position Monitoring & Order Fills');
      await this.positionMonitor.checkOrderFills(configData);

      // 2.2 Market Data Scanning  
      console.log('\n📈 Step 2: Market Data Scanning');
      await this.marketScanner.scanMarkets(configData);

      // 2.3 Signal Analysis (using unified service)
      console.log('\n🔍 Step 3: Signal Analysis');
      await this.signalAnalysisService.analyzeAndCreateSignals(configData);

      // 2.4 Signal Execution
      console.log('\n⚡ Step 4: Signal Execution');
      await this.signalExecutor.executeSignal(configData);

      // 2.5 End-of-Day Management
      console.log('\n🌅 Step 5: End-of-Day Management');
      await this.eodManager.manageEndOfDay(configData);

      console.log('✅ === MAIN TRADING LOOP CYCLE COMPLETE ===\n');
      
    } catch (error) {
      console.error('❌ Error in main trading loop cycle:', error);
      throw error;
    }
  }

  isEngineRunning(): boolean {
    return this.isRunning;
  }
}
