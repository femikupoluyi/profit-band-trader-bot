import { TestFrameworkResults } from './TestFrameworkOrchestrator';
import { SystemValidationReport } from '../TradingSystemValidator';
import { TestResult } from '@/components/trading/test/types';

export interface TestReport {
  executiveSummary: string;
  detailedResults: {
    systemHealth: string;
    integrationTests: string;
    basicTests: string;
    comprehensiveTests: string;
  };
  recommendations: string[];
  actionItems: string[];
  readinessAssessment: {
    readyForTrading: boolean;
    confidence: 'high' | 'medium' | 'low';
    blockers: string[];
  };
}

/**
 * Generates comprehensive test reports for trading system validation
 */
export class TestReportGenerator {
  
  static generateReport(results: TestFrameworkResults): TestReport {
    const executiveSummary = this.generateExecutiveSummary(results);
    const detailedResults = this.generateDetailedResults(results);
    const recommendations = this.consolidateRecommendations(results);
    const actionItems = this.generateActionItems(results);
    const readinessAssessment = this.assessReadiness(results);

    return {
      executiveSummary,
      detailedResults,
      recommendations,
      actionItems,
      readinessAssessment
    };
  }

  private static generateExecutiveSummary(results: TestFrameworkResults): string {
    const { summary, overallStatus } = results;
    const passRate = Math.round((summary.passed / summary.totalTests) * 100);
    
    let statusEmoji = '✅';
    let statusText = 'PASSED';
    
    if (overallStatus === 'fail') {
      statusEmoji = '❌';
      statusText = 'FAILED';
    } else if (overallStatus === 'warning') {
      statusEmoji = '⚠️';
      statusText = 'PASSED WITH WARNINGS';
    }

    return `${statusEmoji} Trading System Validation ${statusText}

📊 Test Results: ${summary.passed}/${summary.totalTests} tests passed (${passRate}%)
🔄 System Health: ${results.systemValidation.systemHealth.overall.toUpperCase()}
🚀 Trading Ready: ${results.systemValidation.readyForTrading ? 'YES' : 'NO'}
📋 Recommendations: ${summary.recommendations.length} items to review

Status: The trading system ${overallStatus === 'pass' ? 'is ready for use' : overallStatus === 'warning' ? 'has minor issues that should be addressed' : 'has critical issues that must be resolved before trading'}.`;
  }

  private static generateDetailedResults(results: TestFrameworkResults): TestReport['detailedResults'] {
    return {
      systemHealth: this.formatHealthResults(results.systemValidation.systemHealth),
      integrationTests: this.formatIntegrationResults(results.systemValidation.integrationTests),
      basicTests: this.formatBasicResults(results.basicTests),
      comprehensiveTests: this.formatComprehensiveResults(results.comprehensiveTests)
    };
  }

  private static formatHealthResults(health: any): string {
    const checks = Object.entries(health.checks).map(([name, check]: [string, any]) => {
      const statusEmoji = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      return `${statusEmoji} ${name}: ${check.message}`;
    }).join('\n');

    return `Overall Health: ${health.overall.toUpperCase()}\n\nChecks:\n${checks}`;
  }

  private static formatIntegrationResults(tests: any): string {
    if (!tests.results) return 'No integration test results available';
    
    const resultsList = tests.results.map((test: any) => {
      const statusEmoji = test.passed ? '✅' : '❌';
      return `${statusEmoji} ${test.testName}: ${test.message} (${test.duration}ms)`;
    }).join('\n');

    return `Integration Tests: ${tests.passed}/${tests.totalTests} passed\n\n${resultsList}`;
  }

  private static formatBasicResults(tests: TestResult[]): string {
    if (tests.length === 0) return 'No basic test results available';
    
    const resultsList = tests.map(test => {
      const statusEmoji = test.status === 'success' ? '✅' : test.status === 'warning' ? '⚠️' : '❌';
      return `${statusEmoji} ${test.test}: ${test.message}`;
    }).join('\n');

    return `Basic Tests: ${tests.filter(t => t.status === 'success').length}/${tests.length} passed\n\n${resultsList}`;
  }

  private static formatComprehensiveResults(tests: TestResult[]): string {
    if (tests.length === 0) return 'No comprehensive test results available';
    
    const resultsList = tests.map(test => {
      const statusEmoji = test.status === 'success' ? '✅' : test.status === 'warning' ? '⚠️' : '❌';
      return `${statusEmoji} ${test.test}: ${test.message}`;
    }).join('\n');

    return `Comprehensive Tests: ${tests.filter(t => t.status === 'success').length}/${tests.length} passed\n\n${resultsList}`;
  }

  private static consolidateRecommendations(results: TestFrameworkResults): string[] {
    return [...new Set(results.summary.recommendations)]; // Remove duplicates
  }

  private static generateActionItems(results: TestFrameworkResults): string[] {
    const actionItems: string[] = [];
    
    if (results.overallStatus === 'fail') {
      actionItems.push('🚨 CRITICAL: Do not start trading until all failed tests are resolved');
    }
    
    if (results.summary.failed > 0) {
      actionItems.push(`Fix ${results.summary.failed} failed test(s)`);
    }
    
    if (results.summary.warnings > 0) {
      actionItems.push(`Review ${results.summary.warnings} warning(s) and consider improvements`);
    }
    
    if (!results.systemValidation.readyForTrading) {
      actionItems.push('Address system readiness issues before enabling trading');
    }
    
    if (results.systemValidation.systemHealth.overall === 'critical') {
      actionItems.push('Resolve critical health issues immediately');
    }
    
    return actionItems;
  }

  private static assessReadiness(results: TestFrameworkResults): TestReport['readinessAssessment'] {
    const { overallStatus, summary, systemValidation } = results;
    
    let confidence: 'high' | 'medium' | 'low' = 'high';
    const blockers: string[] = [];
    
    if (overallStatus === 'fail') {
      confidence = 'low';
      blockers.push('Critical test failures');
    } else if (overallStatus === 'warning') {
      confidence = 'medium';
      if (summary.warnings > 2) {
        blockers.push('Multiple warnings need attention');
      }
    }
    
    if (!systemValidation.readyForTrading) {
      confidence = 'low';
      blockers.push('System not ready for trading');
    }
    
    if (systemValidation.systemHealth.overall === 'critical') {
      confidence = 'low';
      blockers.push('Critical system health issues');
    }
    
    const passRate = summary.passed / summary.totalTests;
    if (passRate < 0.8) {
      confidence = confidence === 'high' ? 'medium' : 'low';
      blockers.push('Low test pass rate');
    }
    
    return {
      readyForTrading: systemValidation.readyForTrading && overallStatus !== 'fail',
      confidence,
      blockers
    };
  }

  static generateConsoleReport(results: TestFrameworkResults): void {
    const report = this.generateReport(results);
    
    console.log('\n📊 ===== COMPREHENSIVE TEST REPORT =====');
    console.log(report.executiveSummary);
    
    if (report.actionItems.length > 0) {
      console.log('\n🎯 Action Items:');
      report.actionItems.forEach(item => console.log(`  • ${item}`));
    }
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.slice(0, 5).forEach(rec => console.log(`  • ${rec}`));
      if (report.recommendations.length > 5) {
        console.log(`  ... and ${report.recommendations.length - 5} more`);
      }
    }
    
    console.log(`\n🚀 Trading Readiness: ${report.readinessAssessment.readyForTrading ? 'READY' : 'NOT READY'}`);
    console.log(`🎯 Confidence: ${report.readinessAssessment.confidence.toUpperCase()}`);
    
    if (report.readinessAssessment.blockers.length > 0) {
      console.log('\n🚫 Blockers:');
      report.readinessAssessment.blockers.forEach(blocker => console.log(`  • ${blocker}`));
    }
    
    console.log('\n=======================================\n');
  }
}