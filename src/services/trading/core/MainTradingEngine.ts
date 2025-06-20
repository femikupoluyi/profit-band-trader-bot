
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { ServiceContainer } from './ServiceContainer';
import { CredentialsManager } from '../credentialsManager';
import { EnhancedSignalAnalysisService } from './EnhancedSignalAnalysisService';
import { ExecutionOrchestrator } from './execution/ExecutionOrchestrator';
import { SignalProcessorCore } from './execution/SignalProcessor';
import { PositionCleanupService } from './PositionCleanupService';
import { ConfigurationService } from './ConfigurationService';
import { SignalFetcher } from './SignalFetcher';

export class MainTradingEngine {
  private userId: string;
  private config: TradingConfigData;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private positionCleanupService: PositionCleanupService;
  private configurationService: ConfigurationService;
  private signalFetcher: SignalFetcher;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
    this.logger = ServiceContainer.getLogger(userId);
    this.positionCleanupService = new PositionCleanupService(userId);
    this.configurationService = new ConfigurationService(userId);
    this.signalFetcher = new SignalFetcher(userId);
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Enhanced Main Trading Engine...');
      
      // Initialize BybitService
      const credentialsManager = new CredentialsManager(this.userId);
      this.bybitService = await credentialsManager.fetchCredentials();
      
      if (!this.bybitService) {
        throw new Error('Failed to initialize Bybit service - check API credentials');
      }

      // Load fresh configuration
      const freshConfig = await this.configurationService.loadUserConfig();
      if (freshConfig) {
        this.config = freshConfig;
        console.log(`✅ Loaded fresh configuration with ${this.config.trading_pairs.length} trading pairs`);
      }

      // Perform initial position cleanup
      await this.performInitialCleanup();

      console.log('✅ Enhanced Main Trading Engine initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Main Trading Engine:', error);
      throw error;
    }
  }

  private async performInitialCleanup(): Promise<void> {
    try {
      console.log('🧹 Performing initial position cleanup...');
      
      // Audit current positions
      const audit = await this.positionCleanupService.auditPositions();
      
      if (audit.excessivePositions.length > 0) {
        console.log(`⚠️ Found excessive positions in: ${audit.excessivePositions.join(', ')}`);
        await this.positionCleanupService.cleanupAllExcessivePositions(this.config.max_positions_per_pair);
      } else {
        console.log('✅ No excessive positions found');
      }

    } catch (error) {
      console.error('❌ Error in initial cleanup:', error);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Trading engine is already running');
      return;
    }

    try {
      console.log('🚀 Starting Enhanced Main Trading Engine...');
      
      // Refresh configuration before starting
      const freshConfig = await this.configurationService.loadUserConfig();
      if (freshConfig) {
        this.config = freshConfig;
      }

      if (!this.config.is_active) {
        console.log('⚠️ Trading configuration is not active - engine will not start');
        return;
      }

      this.isRunning = true;
      
      // Execute first cycle immediately
      await this.executeMainLoop();
      
      // Schedule subsequent cycles
      const intervalMs = this.config.main_loop_interval_seconds * 1000;
      this.intervalId = setInterval(() => {
        this.executeMainLoop().catch(error => {
          console.error('❌ Error in scheduled main loop:', error);
        });
      }, intervalMs);

      console.log(`✅ Enhanced Main Trading Engine started with ${intervalMs}ms interval`);
      
    } catch (error) {
      console.error('❌ Failed to start Enhanced Main Trading Engine:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async executeMainLoop(): Promise<void> {
    const startTime = Date.now();
    const cycleId = Date.now();
    
    try {
      console.log(`\n🔄 ===== ENHANCED MAIN LOOP EXECUTION START (Cycle #${cycleId}) =====`);
      
      // Refresh configuration at start of each cycle
      const freshConfig = await this.configurationService.loadUserConfig();
      if (freshConfig) {
        this.config = freshConfig;
      }

      if (!this.config.is_active) {
        console.log('⚠️ Trading is not active - skipping cycle');
        return;
      }

      console.log(`📊 Configuration loaded:`, {
        tradingLogic: this.config.trading_logic_type,
        tradingPairs: this.config.trading_pairs,
        maxOrderAmount: this.config.max_order_amount_usd,
        maxPositionsPerPair: this.config.max_positions_per_pair,
        supportLowerBound: this.config.support_lower_bound_percent,
        supportUpperBound: this.config.support_upper_bound_percent
      });

      // Step 1: Position monitoring and cleanup
      console.log('\n📊 STEP 1: Position Monitoring & Cleanup');
      await this.performPositionMonitoring();
      
      // Step 2: Signal analysis and creation
      console.log('\n🧠 STEP 2: Enhanced Signal Analysis & Creation');
      await this.performSignalAnalysis();
      
      // Step 3: Signal execution
      console.log('\n⚡ STEP 3: Signal Execution & Order Placement');
      await this.performSignalExecution();
      
      const executionTime = Date.now() - startTime;
      console.log(`⏱️  Total loop execution time: ${executionTime}ms`);
      console.log('✅ ===== ENHANCED MAIN LOOP EXECUTION COMPLETE =====\n');

      await this.logger.logSystemInfo('Enhanced main loop cycle completed', {
        cycleId,
        tradingLogicUsed: this.config.trading_logic_type,
        tradingPairsProcessed: this.config.trading_pairs.length,
        configurationActive: this.config.is_active,
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`❌ Error in enhanced main loop execution:`, error);
      await this.logger.logError('Enhanced main loop execution failed', error);
    }
  }

  private async performPositionMonitoring(): Promise<void> {
    try {
      // Audit and cleanup positions
      const audit = await this.positionCleanupService.auditPositions();
      
      if (audit.excessivePositions.length > 0) {
        console.log(`⚠️ Cleaning up excessive positions: ${audit.excessivePositions.join(', ')}`);
        await this.positionCleanupService.cleanupAllExcessivePositions(this.config.max_positions_per_pair);
      }

      console.log(`📊 Position Status: ${audit.totalPositions} total positions across ${Object.keys(audit.positionsBySymbol).length} symbols`);
      
    } catch (error) {
      console.error('❌ Error in position monitoring:', error);
    }
  }

  private async performSignalAnalysis(): Promise<void> {
    try {
      console.log(`🧠 Starting signal analysis with ${this.config.trading_logic_type} logic`);
      console.log(`📊 Analyzing ${this.config.trading_pairs.length} trading pairs: ${this.config.trading_pairs.join(', ')}`);
      
      const signalAnalysisService = new EnhancedSignalAnalysisService(this.userId, this.bybitService);
      await signalAnalysisService.analyzeAndCreateSignals(this.config);
      
      console.log(`✅ Signal analysis completed`);
    } catch (error) {
      console.error('❌ Error in signal analysis:', error);
      await this.logger.logError('Signal analysis failed in main loop', error);
    }
  }

  private async performSignalExecution(): Promise<void> {
    try {
      const executionOrchestrator = new ExecutionOrchestrator(this.userId);
      const signalProcessor = new SignalProcessorCore(this.userId);
      
      const canExecute = await executionOrchestrator.validateExecution(this.config);
      if (!canExecute) {
        console.log('⚠️ Signal execution validation failed - skipping execution');
        return;
      }

      await executionOrchestrator.logExecutionStart();
      
      // Fetch signals using SignalFetcher
      const signals = await this.signalFetcher.getUnprocessedSignals();
      
      if (signals.length === 0) {
        console.log('📭 No unprocessed signals found for execution');
        await executionOrchestrator.logExecutionComplete();
        return;
      }
      
      // Process signals
      const results = await signalProcessor.processSignals(signals);
      
      console.log(`📊 Signal Execution Results: ${results.success} successful, ${results.failed} failed`);
      
      await executionOrchestrator.logExecutionComplete();
      
    } catch (error) {
      console.error('❌ Error in signal execution:', error);
      await this.logger.logError('Signal execution failed in main loop', error);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Trading engine is not running');
      return;
    }

    try {
      this.isRunning = false;
      
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      console.log('✅ Enhanced Main Trading Engine stopped');
      
    } catch (error) {
      console.error('❌ Error stopping Enhanced Main Trading Engine:', error);
      throw error;
    }
  }

  isEngineRunning(): boolean {
    return this.isRunning;
  }
}
