
import { IntegrationTestRunner, TestSuiteResult } from './IntegrationTestRunner';
import { SystemHealthChecker, SystemHealthReport } from './SystemHealthChecker';
import { ServiceContainer } from './ServiceContainer';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export interface SystemValidationReport {
  timestamp: string;
  systemHealth: SystemHealthReport;
  integrationTests: TestSuiteResult;
  recommendations: string[];
  readyForTrading: boolean;
}

export class TradingSystemValidator {
  private userId: string;
  private bybitService: BybitService;
  private testRunner: IntegrationTestRunner;
  private healthChecker: SystemHealthChecker;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.testRunner = new IntegrationTestRunner(userId, bybitService);
    this.healthChecker = new SystemHealthChecker(userId, bybitService);
  }

  async validateTradingSystem(config: TradingConfigData): Promise<SystemValidationReport> {
    console.log(`🔍 ===== TRADING SYSTEM VALIDATION START =====`);
    
    const logger = ServiceContainer.getLogger(this.userId);
    await logger.logSystemInfo('Starting comprehensive system validation', {
      userId: this.userId,
      configActive: config.is_active,
      tradingPairs: config.trading_pairs.length
    });

    // Run system health check
    console.log(`🏥 Running system health check...`);
    const systemHealth = await this.healthChecker.performHealthCheck(config);
    
    // Run integration tests
    console.log(`🧪 Running integration test suite...`);
    const integrationTests = await this.testRunner.runFullTestSuite(config);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(systemHealth, integrationTests, config);
    
    // Determine if system is ready for trading
    const readyForTrading = this.assessTradingReadiness(systemHealth, integrationTests);
    
    const report: SystemValidationReport = {
      timestamp: new Date().toISOString(),
      systemHealth,
      integrationTests,
      recommendations,
      readyForTrading
    };

    console.log(`🔍 System Validation Complete:`);
    console.log(`📊 Health: ${systemHealth.overall}`);
    console.log(`📊 Tests: ${integrationTests.passed}/${integrationTests.totalTests} passed`);
    console.log(`📊 Ready for Trading: ${readyForTrading ? 'YES' : 'NO'}`);
    console.log(`📊 Recommendations: ${recommendations.length}`);

    await logger.logSystemInfo('System validation completed', {
      healthStatus: systemHealth.overall,
      testsPassed: integrationTests.passed,
      testsTotal: integrationTests.totalTests,
      readyForTrading,
      recommendationCount: recommendations.length
    });

    return report;
  }

  private generateRecommendations(
    health: SystemHealthReport, 
    tests: TestSuiteResult, 
    config: TradingConfigData
  ): string[] {
    const recommendations: string[] = [];

    // Health-based recommendations
    if (health.overall === 'critical') {
      recommendations.push('CRITICAL: System health is compromised. Do not start trading until issues are resolved.');
    }

    if (health.checks.database.status === 'fail') {
      recommendations.push('Fix database connectivity issues before proceeding.');
    }

    if (health.checks.bybitConnection.status === 'fail') {
      recommendations.push('Resolve Bybit API connection problems. Check API credentials and network connectivity.');
    }

    if (health.checks.configuration.status === 'fail') {
      recommendations.push('Review and fix trading configuration errors.');
    }

    // Test-based recommendations
    if (tests.failed > 0) {
      recommendations.push(`${tests.failed} integration tests failed. Review test results for specific issues.`);
    }

    // Configuration recommendations
    if (config.trading_pairs.length === 0) {
      recommendations.push('Add at least one trading pair to the configuration.');
    }

    if (config.max_order_amount_usd > 1000) {
      recommendations.push('Consider reducing max order amount for safer initial trading.');
    }

    if (!config.is_active) {
      recommendations.push('Enable trading configuration when ready to start automated trading.');
    }

    if (config.max_positions_per_pair > 3) {
      recommendations.push('Consider reducing max positions per pair to limit risk exposure.');
    }

    // Performance recommendations
    if (tests.duration > 10000) {
      recommendations.push('System response times are slow. Consider optimizing database queries or API calls.');
    }

    // Safety recommendations
    if (config.max_portfolio_exposure_percent > 50) {
      recommendations.push('Portfolio exposure is high. Consider reducing to limit overall risk.');
    }

    return recommendations;
  }

  private assessTradingReadiness(health: SystemHealthReport, tests: TestSuiteResult): boolean {
    // System must not be in critical health
    if (health.overall === 'critical') {
      return false;
    }

    // Core systems must be functional
    if (health.checks.database.status === 'fail' || 
        health.checks.bybitConnection.status === 'fail') {
      return false;
    }

    // Most tests should pass
    const passRate = tests.passed / tests.totalTests;
    if (passRate < 0.7) { // At least 70% of tests must pass
      return false;
    }

    // Signal processing pipeline must work
    const signalTest = tests.results.find(r => r.testName === 'Signal Processing Pipeline');
    if (signalTest && !signalTest.passed) {
      return false;
    }

    return true;
  }

  async performQuickHealthCheck(config: TradingConfigData): Promise<boolean> {
    try {
      const health = await this.healthChecker.performHealthCheck(config);
      return health.overall !== 'critical';
    } catch (error) {
      console.error('Quick health check failed:', error);
      return false;
    }
  }
}
