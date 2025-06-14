import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SignalExecutionService } from './SignalExecutionService';
import { EnhancedSignalAnalysisService } from './EnhancedSignalAnalysisService';
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
  private signalAnalysisService: EnhancedSignalAnalysisService;
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
    
    // Initialize services with ENHANCED signal analysis service
    this.signalAnalysisService = new EnhancedSignalAnalysisService(userId, this.bybitService);
    this.signalExecutionService = new SignalExecutionService(userId, this.bybitService);
    this.positionMonitorService = new PositionMonitorService(userId, this.bybitService);
    this.reconciliationService = new TransactionReconciliationService(userId, this.bybitService);
    this.positionSyncService = new PositionSyncService(userId, this.bybitService);
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🔧 Initializing Enhanced MainTradingEngine...');
      await this.logger.logSuccess('Enhanced MainTradingEngine initialization started');

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
      
      // Reinitialize services with proper credentials - USING ENHANCED SERVICE
      this.signalAnalysisService = new EnhancedSignalAnalysisService(this.userId, this.bybitService);
      this.signalExecutionService = new SignalExecutionService(this.userId, this.bybitService);
      this.positionMonitorService = new PositionMonitorService(this.userId, this.bybitService);
      this.reconciliationService = new TransactionReconciliationService(this.userId, this.bybitService);
      this.positionSyncService = new PositionSyncService(this.userId, this.bybitService);

      // Log trading configuration details
      console.log('📋 ===== ENHANCED TRADING CONFIGURATION SUMMARY =====');
      console.log(`🧠 Selected Trading Logic: ${this.config.trading_logic_type}`);
      console.log(`📊 Trading Pairs: ${this.config.trading_pairs.join(', ')}`);
      console.log(`💰 Max Order Amount: $${this.config.max_order_amount_usd}`);
      console.log(`🎯 Take Profit: ${this.config.take_profit_percent}%`);
      console.log(`📈 Entry Offset: ${this.config.entry_offset_percent}%`);
      console.log(`🔄 Max Positions Per Pair: ${this.config.max_positions_per_pair}`);
      console.log(`⚙️ Configuration Active: ${this.config.is_active ? 'YES' : 'NO'}`);
      
      if (this.config.trading_logic_type === 'logic2_data_driven') {
        console.log('🎯 ===== LOGIC 2 DETERMINISTIC PARAMETERS =====');
        console.log(`📊 Swing Analysis Bars: ${this.config.swing_analysis_bars}`);
        console.log(`📈 Volume Lookback Periods: ${this.config.volume_lookback_periods}`);
        console.log(`🔢 Fibonacci Sensitivity: ${this.config.fibonacci_sensitivity}`);
        console.log(`📏 ATR Multiplier: ${this.config.atr_multiplier}`);
        console.log('🔥 Logic 2 DETERMINISTIC MODE - Trades WILL be placed when market data exists');
        console.log('✅ Enhanced logging will show exactly why trades are/aren\'t placed');
      }
      
      await this.logger.logConfigurationChange({
        tradingLogicType: this.config.trading_logic_type,
        tradingPairs: this.config.trading_pairs,
        maxOrderAmount: this.config.max_order_amount_usd,
        isActive: this.config.is_active,
        logic2Parameters: this.config.trading_logic_type === 'logic2_data_driven' ? {
          swingAnalysisBars: this.config.swing_analysis_bars,
          volumeLookbackPeriods: this.config.volume_lookback_periods,
          fibonacciSensitivity: this.config.fibonacci_sensitivity,
          atrMultiplier: this.config.atr_multiplier
        } : null
      });

      // FAST startup position sync - reduced scope
      console.log('🔄 Performing quick startup position synchronization...');
      try {
        await Promise.race([
          this.positionSyncService.performStartupSync(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 10000))
        ]);
      } catch (error) {
        console.warn('⚠️ Startup sync took too long or failed, continuing anyway:', error);
      }

      // FAST startup reconciliation - reduced scope
      console.log('🔄 Performing quick startup reconciliation...');
      try {
        await Promise.race([
          this.reconciliationService.performStartupReconciliation(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Reconciliation timeout')), 10000))
        ]);
      } catch (error) {
        console.warn('⚠️ Startup reconciliation took too long or failed, continuing anyway:', error);
      }

      console.log('✅ Enhanced MainTradingEngine initialized successfully');
      await this.logger.logSuccess('Enhanced MainTradingEngine initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced MainTradingEngine:', error);
      await this.logger.logError('Enhanced MainTradingEngine initialization failed', error);
      return false;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Enhanced MainTradingEngine is already running');
      return;
    }

    try {
      console.log('🚀 Starting Enhanced MainTradingEngine...');
      await this.logger.logSuccess('Enhanced MainTradingEngine starting');
      
      this.isRunning = true;
      
      // Start the main trading loop
      await this.startMainLoop();
      
      console.log('✅ Enhanced MainTradingEngine started successfully');
      await this.logger.logSuccess('Enhanced MainTradingEngine started successfully');
      
    } catch (error) {
      console.error('❌ Error starting Enhanced MainTradingEngine:', error);
      await this.logger.logError('Failed to start Enhanced MainTradingEngine', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      console.log('🛑 Stopping Enhanced MainTradingEngine...');
      await this.logger.logSuccess('Enhanced MainTradingEngine stopping');
      
      this.isRunning = false;
      
      if (this.mainLoopInterval) {
        clearInterval(this.mainLoopInterval);
        this.mainLoopInterval = null;
      }
      
      console.log('✅ Enhanced MainTradingEngine stopped successfully');
      await this.logger.logSuccess('Enhanced MainTradingEngine stopped successfully');
      
    } catch (error) {
      console.error('❌ Error stopping Enhanced MainTradingEngine:', error);
      await this.logger.logError('Failed to stop Enhanced MainTradingEngine', error);
      throw error;
    }
  }

  private async startMainLoop(): Promise<void> {
    const intervalMs = (this.config.main_loop_interval_seconds || 30) * 1000;
    console.log(`⏰ Starting enhanced main loop with ${intervalMs / 1000}s interval`);

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
      console.log('\n🔄 ===== ENHANCED MAIN LOOP EXECUTION START =====');
      console.log(`⏰ Loop Time: ${new Date().toISOString()}`);
      console.log(`🧠 Active Trading Logic: ${this.config.trading_logic_type}`);
      console.log(`📊 Trading Pairs: [${this.config.trading_pairs.join(', ')}]`);
      console.log(`🔄 Configuration Active: ${this.config.is_active ? 'YES' : 'NO'}`);
      
      if (!this.config.is_active) {
        console.log('⚠️ Configuration is INACTIVE - skipping trading loop');
        return;
      }
      
      await this.logger.logCycleStart(Date.now(), this.config);
      
      // 1. Quick sync positions with exchange first
      console.log('\n📊 STEP 1: Quick Position Synchronization');
      try {
        await Promise.race([
          this.positionSyncService.syncAllPositionsWithExchange(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 15000))
        ]);
      } catch (error) {
        console.warn('⚠️ Position sync took too long, continuing anyway:', error);
      }
      
      // 2. Monitor and check order fills
      console.log('\n👀 STEP 2: Position Monitoring & Order Fill Checks');
      await this.positionMonitorService.checkOrderFills(this.config);
      
      // 3. ENHANCED SIGNAL ANALYSIS
      console.log('\n🧠 STEP 3: Enhanced Signal Analysis & Generation');
      console.log(`🎯 Using Trading Logic: ${this.config.trading_logic_type}`);
      if (this.config.trading_logic_type === 'logic2_data_driven') {
        console.log('🔥 LOGIC 2 DETERMINISTIC MODE - Comprehensive analysis starting...');
        console.log('📊 This will analyze swing lows, volume profiles, and ATR-based bounds');
        console.log('✅ Enhanced logging will show every step of the process');
      }
      await this.signalAnalysisService.analyzeAndCreateSignals(this.config);
      
      // 4. Execute signals
      console.log('\n⚡ STEP 4: Signal Execution & Order Placement');
      await this.signalExecutionService.executeSignal(this.config);
      
      // 5. Reconcile transactions every few loops (reduced frequency)
      if (Math.random() < 0.05) { // 5% chance each loop (reduced from 10%)
        console.log('\n🔍 STEP 5: Quick Transaction Reconciliation');
        try {
          await Promise.race([
            this.reconciliationService.reconcileWithBybitHistory(3), // 3 hours lookback (reduced from 6)
            new Promise((_, reject) => setTimeout(() => reject(new Error('Reconciliation timeout')), 20000))
          ]);
        } catch (error) {
          console.warn('⚠️ Reconciliation took too long, skipping:', error);
        }
      }
      
      console.log('✅ ===== ENHANCED MAIN LOOP EXECUTION COMPLETE =====\n');
      
      await this.logger.logCycleComplete(Date.now(), {
        tradingLogicUsed: this.config.trading_logic_type,
        tradingPairsProcessed: this.config.trading_pairs.length,
        configurationActive: this.config.is_active
      });
      
    } catch (error) {
      console.error('❌ Error in enhanced main loop execution:', error);
      await this.logger.logError('Enhanced main loop execution failed', error);
    }
  }

  isEngineRunning(): boolean {
    return this.isRunning;
  }

  updateConfig(newConfig: TradingConfigData): void {
    this.config = newConfig;
    console.log('📋 Enhanced trading configuration updated');
    console.log(`🧠 New Trading Logic: ${newConfig.trading_logic_type}`);
    console.log(`⚙️ New Configuration Active: ${newConfig.is_active ? 'YES' : 'NO'}`);
    if (newConfig.trading_logic_type === 'logic2_data_driven') {
      console.log('🎯 Logic 2 Parameters Updated - Enhanced deterministic mode active');
    }
    
    // Reinitialize enhanced signal analysis service with new config
    this.signalAnalysisService = new EnhancedSignalAnalysisService(this.userId, this.bybitService);
  }
}
