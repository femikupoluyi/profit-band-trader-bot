import { TradingSystemValidator, SystemValidationReport } from '../TradingSystemValidator';
import { IntegrationTestRunner, TestSuiteResult } from '../IntegrationTestRunner';
import { SystemHealthChecker, SystemHealthReport } from '../SystemHealthChecker';
import { ComprehensiveTestRunner } from '@/components/trading/test/comprehensiveTestRunner';
import { TestRunner } from '@/components/trading/test/testRunner';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../../bybitService';
import { ServiceContainer } from '../ServiceContainer';
import { TestResult } from '@/components/trading/test/types';

export interface TestFrameworkResults {
  timestamp: string;
  systemValidation: SystemValidationReport;
  basicTests: TestResult[];
  comprehensiveTests: TestResult[];
  overallStatus: 'pass' | 'warning' | 'fail';
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    warnings: number;
    recommendations: string[];
  };
}

/**
 * PHASE 4: Comprehensive Testing & Validation Framework
 * Orchestrates all testing components for complete system validation
 */
export class TestFrameworkOrchestrator {
  private userId: string;
  private bybitService: BybitService;
  private systemValidator: TradingSystemValidator;
  private basicTestRunner: TestRunner;
  private comprehensiveTestRunner: ComprehensiveTestRunner;
  private logger: any;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.systemValidator = new TradingSystemValidator(userId, bybitService);
    this.basicTestRunner = new TestRunner(userId, () => {});
    this.comprehensiveTestRunner = new ComprehensiveTestRunner(userId);
    this.logger = ServiceContainer.getLogger(userId);
  }

  async runCompleteTestSuite(config: TradingConfigData): Promise<TestFrameworkResults> {
    console.log('\n🚀 ===== COMPREHENSIVE TEST FRAMEWORK START =====');
    const startTime = Date.now();

    await this.logger.logSystemInfo('Starting comprehensive test framework', {
      userId: this.userId,
      configActive: config.is_active,
      timestamp: new Date().toISOString()
    });

    try {
      // Phase 1: System Validation (health, integration tests)
      console.log('📊 Phase 1: Running system validation...');
      const systemValidation = await this.systemValidator.validateTradingSystem(config);

      // Phase 2: Basic API and Configuration Tests
      console.log('🧪 Phase 2: Running basic test suite...');
      const basicTests = await this.runBasicTests();

      // Phase 3: Comprehensive Validation Tests
      console.log('🔍 Phase 3: Running comprehensive validation tests...');
      const comprehensiveTests = await this.comprehensiveTestRunner.runAllValidationTests();

      // Phase 4: Generate consolidated results
      const results = this.consolidateResults(
        systemValidation,
        basicTests,
        comprehensiveTests,
        Date.now() - startTime
      );

      console.log('\n📈 ===== TEST FRAMEWORK COMPLETE =====');
      console.log(`📊 Overall Status: ${results.overallStatus.toUpperCase()}`);
      console.log(`📊 Tests: ${results.summary.passed}/${results.summary.totalTests} passed`);
      console.log(`📊 Duration: ${Date.now() - startTime}ms`);

      await this.logger.logSystemInfo('Test framework completed', {
        overallStatus: results.overallStatus,
        totalTests: results.summary.totalTests,
        passed: results.summary.passed,
        failed: results.summary.failed,
        warnings: results.summary.warnings,
        duration: Date.now() - startTime
      });

      return results;

    } catch (error) {
      console.error('❌ Test framework error:', error);
      await this.logger.logError('Test framework failed', error);
      throw error;
    }
  }

  private async runBasicTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    let currentResults: TestResult[] = [];

    // Update function to capture results
    const updateFunction = (newResults: TestResult[]) => {
      currentResults = [...newResults];
    };

    // Create new test runner with update function
    const testRunner = new TestRunner(this.userId, updateFunction);
    
    try {
      await testRunner.runAllTests();
      return currentResults;
    } catch (error) {
      console.error('Basic tests failed:', error);
      return [{
        test: 'Basic Test Suite',
        status: 'error',
        message: `Basic tests failed: ${error.message}`
      }];
    }
  }

  private consolidateResults(
    systemValidation: SystemValidationReport,
    basicTests: TestResult[],
    comprehensiveTests: TestResult[],
    duration: number
  ): TestFrameworkResults {
    
    // Count results
    const allTests = [...basicTests, ...comprehensiveTests];
    const passed = allTests.filter(t => t.status === 'success').length + 
                   (systemValidation.integrationTests.passed || 0);
    const failed = allTests.filter(t => t.status === 'error').length + 
                   (systemValidation.integrationTests.failed || 0);
    const warnings = allTests.filter(t => t.status === 'warning').length;
    const totalTests = allTests.length + (systemValidation.integrationTests.totalTests || 0);

    // Determine overall status
    let overallStatus: 'pass' | 'warning' | 'fail' = 'pass';
    
    if (systemValidation.systemHealth.overall === 'critical' || failed > 0) {
      overallStatus = 'fail';
    } else if (systemValidation.systemHealth.overall === 'warning' || warnings > 0 || !systemValidation.readyForTrading) {
      overallStatus = 'warning';
    }

    // Consolidate recommendations
    const recommendations = [
      ...systemValidation.recommendations,
      ...this.generateTestRecommendations(basicTests, comprehensiveTests)
    ];

    return {
      timestamp: new Date().toISOString(),
      systemValidation,
      basicTests,
      comprehensiveTests,
      overallStatus,
      summary: {
        totalTests,
        passed,
        failed,
        warnings,
        recommendations
      }
    };
  }

  private generateTestRecommendations(basicTests: TestResult[], comprehensiveTests: TestResult[]): string[] {
    const recommendations: string[] = [];
    
    const failedBasic = basicTests.filter(t => t.status === 'error');
    const failedComprehensive = comprehensiveTests.filter(t => t.status === 'error');
    
    if (failedBasic.length > 0) {
      recommendations.push(`${failedBasic.length} basic tests failed - review API credentials and configuration`);
    }
    
    if (failedComprehensive.length > 0) {
      recommendations.push(`${failedComprehensive.length} comprehensive tests failed - review system architecture`);
    }
    
    const warningTests = [...basicTests, ...comprehensiveTests].filter(t => t.status === 'warning');
    if (warningTests.length > 0) {
      recommendations.push(`${warningTests.length} tests have warnings - monitor closely`);
    }
    
    return recommendations;
  }

  async runQuickHealthCheck(config: TradingConfigData): Promise<boolean> {
    try {
      return await this.systemValidator.performQuickHealthCheck(config);
    } catch (error) {
      console.error('Quick health check failed:', error);
      return false;
    }
  }

  async runTargetedTest(testType: 'health' | 'integration' | 'basic' | 'comprehensive', config: TradingConfigData): Promise<any> {
    switch (testType) {
      case 'health':
        const healthChecker = new SystemHealthChecker(this.userId, this.bybitService);
        return await healthChecker.performHealthCheck(config);
      
      case 'integration':
        const integrationRunner = new IntegrationTestRunner(this.userId, this.bybitService);
        return await integrationRunner.runFullTestSuite(config);
      
      case 'basic':
        return await this.runBasicTests();
      
      case 'comprehensive':
        return await this.comprehensiveTestRunner.runAllValidationTests();
      
      default:
        throw new Error(`Unknown test type: ${testType}`);
    }
  }
}