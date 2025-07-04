import { TestFrameworkOrchestrator, TestFrameworkResults } from './TestFrameworkOrchestrator';
import { TestReportGenerator } from './TestReportGenerator';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../../bybitService';
import { ServiceContainer } from '../ServiceContainer';

export interface ScheduledTestConfig {
  enabled: boolean;
  intervalMinutes: number;
  testTypes: ('health' | 'integration' | 'basic' | 'comprehensive')[];
  alertOnFailure: boolean;
  maxConsecutiveFailures: number;
}

/**
 * Manages scheduled and on-demand testing of the trading system
 */
export class TestScheduler {
  private userId: string;
  private bybitService: BybitService;
  private orchestrator: TestFrameworkOrchestrator;
  private logger: any;
  private scheduledTestInterval?: NodeJS.Timeout;
  private consecutiveFailures = 0;
  
  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.orchestrator = new TestFrameworkOrchestrator(userId, bybitService);
    this.logger = ServiceContainer.getLogger(userId);
  }

  async scheduleTests(config: ScheduledTestConfig, tradingConfig: TradingConfigData): Promise<void> {
    if (!config.enabled) {
      this.stopScheduledTests();
      return;
    }

    console.log(`📅 Scheduling tests every ${config.intervalMinutes} minutes`);
    
    this.scheduledTestInterval = setInterval(async () => {
      try {
        await this.runScheduledTests(config, tradingConfig);
      } catch (error) {
        console.error('❌ Scheduled test execution failed:', error);
        await this.logger.logError('Scheduled test execution failed', error);
      }
    }, config.intervalMinutes * 60 * 1000);

    await this.logger.logSystemInfo('Test scheduling enabled', {
      intervalMinutes: config.intervalMinutes,
      testTypes: config.testTypes
    });
  }

  stopScheduledTests(): void {
    if (this.scheduledTestInterval) {
      clearInterval(this.scheduledTestInterval);
      this.scheduledTestInterval = undefined;
      console.log('📅 Scheduled tests stopped');
    }
  }

  private async runScheduledTests(config: ScheduledTestConfig, tradingConfig: TradingConfigData): Promise<void> {
    console.log('🔄 Running scheduled tests...');
    
    const startTime = Date.now();
    let overallSuccess = true;

    for (const testType of config.testTypes) {
      try {
        const result = await this.orchestrator.runTargetedTest(testType, tradingConfig);
        
        if (testType === 'health') {
          overallSuccess = overallSuccess && result.overall !== 'critical';
        } else if (testType === 'integration') {
          overallSuccess = overallSuccess && result.failed === 0;
        } else {
          overallSuccess = overallSuccess && !result.some((r: any) => r.status === 'error');
        }
        
      } catch (error) {
        console.error(`❌ Scheduled ${testType} test failed:`, error);
        overallSuccess = false;
      }
    }

    const duration = Date.now() - startTime;
    
    if (overallSuccess) {
      this.consecutiveFailures = 0;
      console.log(`✅ Scheduled tests completed successfully in ${duration}ms`);
    } else {
      this.consecutiveFailures++;
      console.log(`❌ Scheduled tests failed (${this.consecutiveFailures} consecutive failures)`);
      
      if (config.alertOnFailure && this.consecutiveFailures >= config.maxConsecutiveFailures) {
        await this.handleConsecutiveFailures(config);
      }
    }

    await this.logger.logSystemInfo('Scheduled test completed', {
      success: overallSuccess,
      duration,
      consecutiveFailures: this.consecutiveFailures,
      testTypes: config.testTypes
    });
  }

  private async handleConsecutiveFailures(config: ScheduledTestConfig): Promise<void> {
    console.log(`🚨 ALERT: ${this.consecutiveFailures} consecutive test failures detected!`);
    
    await this.logger.logError('Consecutive test failures alert', new Error(`${this.consecutiveFailures} consecutive failures`), {
      threshold: config.maxConsecutiveFailures,
      failureCount: this.consecutiveFailures
    });

    // In a production system, this could:
    // - Send email/SMS alerts
    // - Disable trading temporarily
    // - Escalate to support teams
    // - Run extended diagnostics
  }

  async runOnDemandTest(
    testType: 'full' | 'health' | 'integration' | 'basic' | 'comprehensive',
    tradingConfig: TradingConfigData
  ): Promise<TestFrameworkResults | any> {
    console.log(`🔍 Running on-demand ${testType} test...`);
    
    try {
      if (testType === 'full') {
        const results = await this.orchestrator.runCompleteTestSuite(tradingConfig);
        TestReportGenerator.generateConsoleReport(results);
        return results;
      } else {
        return await this.orchestrator.runTargetedTest(testType, tradingConfig);
      }
    } catch (error) {
      console.error(`❌ On-demand ${testType} test failed:`, error);
      await this.logger.logError(`On-demand ${testType} test failed`, error);
      throw error;
    }
  }

  async runPreTradingValidation(tradingConfig: TradingConfigData): Promise<boolean> {
    console.log('🏁 Running pre-trading validation...');
    
    try {
      // Quick health check first
      const healthOk = await this.orchestrator.runQuickHealthCheck(tradingConfig);
      if (!healthOk) {
        console.log('❌ Pre-trading validation failed: Health check failed');
        return false;
      }

      // Run essential tests
      const results = await this.orchestrator.runCompleteTestSuite(tradingConfig);
      
      const isReady = results.overallStatus !== 'fail' && results.systemValidation.readyForTrading;
      
      if (isReady) {
        console.log('✅ Pre-trading validation passed - system ready for trading');
      } else {
        console.log('❌ Pre-trading validation failed - trading not recommended');
        TestReportGenerator.generateConsoleReport(results);
      }
      
      return isReady;
      
    } catch (error) {
      console.error('❌ Pre-trading validation error:', error);
      await this.logger.logError('Pre-trading validation failed', error);
      return false;
    }
  }

  getTestStatus(): {
    scheduled: boolean;
    consecutiveFailures: number;
    lastRunTime?: string;
  } {
    return {
      scheduled: !!this.scheduledTestInterval,
      consecutiveFailures: this.consecutiveFailures,
      lastRunTime: undefined // Could be tracked if needed
    };
  }
}