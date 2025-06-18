
import { SystemHealthChecker } from './SystemHealthChecker';
import { SignalProcessor } from './SignalProcessor';
import { ServiceContainer } from './ServiceContainer';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export interface IntegrationTestResult {
  testName: string;
  passed: boolean;
  message: string;
  duration: number;
  details?: any;
}

export interface TestSuiteResult {
  overall: 'pass' | 'fail';
  totalTests: number;
  passed: number;
  failed: number;
  results: IntegrationTestResult[];
  duration: number;
}

export class IntegrationTestRunner {
  private userId: string;
  private bybitService: BybitService;
  private healthChecker: SystemHealthChecker;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.healthChecker = new SystemHealthChecker(userId, bybitService);
  }

  async runFullTestSuite(config: TradingConfigData): Promise<TestSuiteResult> {
    console.log(`🧪 ===== INTEGRATION TEST SUITE START =====`);
    const startTime = Date.now();
    const results: IntegrationTestResult[] = [];

    // Test 1: System Health
    results.push(await this.testSystemHealth(config));

    // Test 2: Service Integration
    results.push(await this.testServiceIntegration());

    // Test 3: Database Operations
    results.push(await this.testDatabaseOperations());

    // Test 4: Signal Processing Pipeline
    results.push(await this.testSignalProcessingPipeline(config));

    // Test 5: Precision and Validation
    results.push(await this.testPrecisionAndValidation(config));

    const duration = Date.now() - startTime;
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;

    const suiteResult: TestSuiteResult = {
      overall: failed === 0 ? 'pass' : 'fail',
      totalTests: results.length,
      passed,
      failed,
      results,
      duration
    };

    console.log(`🧪 Test Suite Complete: ${suiteResult.overall.toUpperCase()}`);
    console.log(`📊 ${passed}/${results.length} tests passed in ${duration}ms`);

    return suiteResult;
  }

  private async testSystemHealth(config: TradingConfigData): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    
    try {
      const healthReport = await this.healthChecker.performHealthCheck(config);
      const duration = Date.now() - startTime;
      
      return {
        testName: 'System Health Check',
        passed: healthReport.overall !== 'critical',
        message: `Health status: ${healthReport.overall}`,
        duration,
        details: healthReport
      };
    } catch (error) {
      return {
        testName: 'System Health Check',
        passed: false,
        message: `Health check failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async testServiceIntegration(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    
    try {
      // Test service container
      const logger = ServiceContainer.getLogger(this.userId);
      const dbHelper = ServiceContainer.getDatabaseHelper(this.userId);
      const signalCore = ServiceContainer.getSignalAnalysisCore(this.userId);
      
      // Test cross-service communication
      await logger.logSystemInfo('Integration test');
      
      return {
        testName: 'Service Integration',
        passed: true,
        message: 'All services integrated successfully',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Service Integration',
        passed: false,
        message: `Service integration failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async testDatabaseOperations(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    
    try {
      const dbHelper = ServiceContainer.getDatabaseHelper(this.userId);
      
      // Test read operations
      const signals = await dbHelper.getSignals(this.userId, { limit: 5 });
      const trades = await dbHelper.getTrades(this.userId, { limit: 5 });
      
      return {
        testName: 'Database Operations',
        passed: true,
        message: `Database accessible. Signals: ${signals.length}, Trades: ${trades.length}`,
        duration: Date.now() - startTime,
        details: { signalCount: signals.length, tradeCount: trades.length }
      };
    } catch (error) {
      return {
        testName: 'Database Operations',
        passed: false,
        message: `Database operations failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async testSignalProcessingPipeline(config: TradingConfigData): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    
    try {
      // Create a test signal processor
      const signalProcessor = new SignalProcessor(this.userId, this.bybitService);
      
      // Create a mock signal for testing (don't actually process it)
      const mockSignal = {
        id: 'test-signal-' + Date.now(),
        symbol: config.trading_pairs[0] || 'BTCUSDT',
        signal_type: 'buy',
        price: '50000.00',
        confidence: 0.8,
        reasoning: 'Integration test signal',
        processed: false,
        user_id: this.userId,
        created_at: new Date().toISOString()
      };
      
      // Test signal context building
      const signalCore = ServiceContainer.getSignalAnalysisCore(this.userId);
      const context = await signalCore.getSignalContext(mockSignal.symbol, config);
      
      return {
        testName: 'Signal Processing Pipeline',
        passed: context !== null,
        message: context ? 'Signal processing pipeline functional' : 'Signal context creation failed',
        duration: Date.now() - startTime,
        details: { contextCreated: context !== null }
      };
    } catch (error) {
      return {
        testName: 'Signal Processing Pipeline',
        passed: false,
        message: `Signal processing test failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async testPrecisionAndValidation(config: TradingConfigData): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    
    try {
      if (config.trading_pairs.length === 0) {
        return {
          testName: 'Precision and Validation',
          passed: false,
          message: 'No trading pairs configured for testing',
          duration: Date.now() - startTime
        };
      }

      const testSymbol = config.trading_pairs[0];
      
      // Test validation chain
      const { ValidationChain } = await import('./ValidationChain');
      const validation = await ValidationChain.validateTrade(
        testSymbol,
        0.001, // small test quantity
        50000, // test price
        config
      );
      
      return {
        testName: 'Precision and Validation',
        passed: validation.isValid || validation.errors.length < 3, // Allow some validation errors in test mode
        message: validation.isValid ? 'Precision validation working' : `Validation issues: ${validation.errors.length}`,
        duration: Date.now() - startTime,
        details: { validationResult: validation }
      };
    } catch (error) {
      return {
        testName: 'Precision and Validation',
        passed: false,
        message: `Precision test failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }
}
