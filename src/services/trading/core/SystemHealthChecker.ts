
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';

interface HealthCheck {
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
  timestamp: string;
}

interface HealthReport {
  overall: 'healthy' | 'warning' | 'critical';
  checks: Record<string, HealthCheck>;
  timestamp: string;
  recommendations: string[];
}

export class SystemHealthChecker {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
  }

  async performHealthCheck(config: TradingConfigData): Promise<HealthReport> {
    const timestamp = new Date().toISOString();
    const checks: Record<string, HealthCheck> = {};
    
    try {
      console.log('\n🏥 ===== SYSTEM HEALTH CHECK START =====');
      
      // Check 1: Database connectivity
      checks.database = await this.checkDatabaseConnectivity();
      
      // Check 2: Bybit API connectivity
      checks.bybitApi = await this.checkBybitApiConnectivity();
      
      // Check 3: Configuration validation
      checks.configuration = await this.checkConfigurationHealth(config);
      
      // Check 4: Market data availability
      checks.marketData = await this.checkMarketDataAvailability(config);
      
      // Check 5: Trading pairs validation
      checks.tradingPairs = await this.checkTradingPairsHealth(config);
      
      // Determine overall health status
      const overall = this.calculateOverallHealth(checks);
      
      // Generate recommendations
      const recommendations = this.generateHealthRecommendations(checks);
      
      const report: HealthReport = {
        overall,
        checks,
        timestamp,
        recommendations
      };
      
      console.log(`🏥 Health check complete - Overall status: ${overall}`);
      console.log(`📋 Found ${Object.keys(checks).length} checks, ${recommendations.length} recommendations`);
      
      await this.logger.logSystemInfo('System health check completed', {
        overall,
        checksCount: Object.keys(checks).length,
        recommendationsCount: recommendations.length,
        failedChecks: Object.entries(checks)
          .filter(([_, check]) => check.status === 'fail')
          .map(([name, _]) => name)
      });
      
      return report;
      
    } catch (error) {
      console.error('❌ Error during health check:', error);
      await this.logger.logError('Health check failed', error);
      
      return {
        overall: 'critical',
        checks: {
          healthCheckError: {
            status: 'fail',
            message: `Health check failed: ${error.message}`,
            timestamp
          }
        },
        timestamp,
        recommendations: ['Fix health check system errors']
      };
    }
  }

  private async checkDatabaseConnectivity(): Promise<HealthCheck> {
    try {
      const { DatabaseConnection } = await import('./database/DatabaseConnection');
      const isConnected = await DatabaseConnection.testConnection();
      
      if (isConnected) {
        return {
          status: 'pass',
          message: 'Database connection is healthy',
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          status: 'fail',
          message: 'Database connection failed',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: `Database check error: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async checkBybitApiConnectivity(): Promise<HealthCheck> {
    try {
      // Simple API connectivity test
      const result = await this.bybitService.getAccountBalance();
      
      if (result && result.retCode === 0) {
        return {
          status: 'pass',
          message: 'Bybit API connection is healthy',
          details: { retCode: result.retCode },
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          status: 'fail',
          message: `Bybit API error: ${result?.retMsg || 'Unknown error'}`,
          details: result,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: `Bybit API check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async checkConfigurationHealth(config: TradingConfigData): Promise<HealthCheck> {
    const issues: string[] = [];
    
    if (!config.is_active) {
      issues.push('Configuration is not active');
    }
    
    if (!config.trading_pairs || config.trading_pairs.length === 0) {
      issues.push('No trading pairs configured');
    }
    
    if (!config.max_order_amount_usd || config.max_order_amount_usd <= 0) {
      issues.push('Invalid max order amount');
    }
    
    if (config.take_profit_percent <= 0) {
      issues.push('Invalid take profit percentage');
    }
    
    if (issues.length === 0) {
      return {
        status: 'pass',
        message: 'Configuration is healthy',
        timestamp: new Date().toISOString()
      };
    } else if (issues.includes('Configuration is not active')) {
      return {
        status: 'warning',
        message: `Configuration issues: ${issues.join(', ')}`,
        details: { issues },
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        status: 'fail',
        message: `Configuration issues: ${issues.join(', ')}`,
        details: { issues },
        timestamp: new Date().toISOString()
      };
    }
  }

  private async checkMarketDataAvailability(config: TradingConfigData): Promise<HealthCheck> {
    try {
      if (!config.trading_pairs || config.trading_pairs.length === 0) {
        return {
          status: 'fail',
          message: 'No trading pairs to check market data for',
          timestamp: new Date().toISOString()
        };
      }
      
      // Test market data for first trading pair
      const testSymbol = config.trading_pairs[0];
      const marketData = await this.bybitService.getMarketTicker(testSymbol);
      
      if (marketData && marketData.retCode === 0 && marketData.result?.list?.length > 0) {
        return {
          status: 'pass',
          message: 'Market data is available',
          details: { testedSymbol: testSymbol },
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          status: 'fail',
          message: 'Market data unavailable or invalid',
          details: { testedSymbol: testSymbol, result: marketData },
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: `Market data check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async checkTradingPairsHealth(config: TradingConfigData): Promise<HealthCheck> {
    const issues: string[] = [];
    
    if (!config.trading_pairs || config.trading_pairs.length === 0) {
      return {
        status: 'fail',
        message: 'No trading pairs configured',
        timestamp: new Date().toISOString()
      };
    }
    
    // Check for valid pair format
    for (const pair of config.trading_pairs) {
      if (!pair || typeof pair !== 'string' || pair.length < 6) {
        issues.push(`Invalid trading pair format: ${pair}`);
      }
    }
    
    if (config.trading_pairs.length > 10) {
      issues.push('Too many trading pairs (>10) may impact performance');
    }
    
    if (issues.length === 0) {
      return {
        status: 'pass',
        message: `${config.trading_pairs.length} trading pairs configured and healthy`,
        details: { pairs: config.trading_pairs },
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        status: 'warning',
        message: `Trading pairs issues: ${issues.join(', ')}`,
        details: { issues, pairs: config.trading_pairs },
        timestamp: new Date().toISOString()
      };
    }
  }

  private calculateOverallHealth(checks: Record<string, HealthCheck>): 'healthy' | 'warning' | 'critical' {
    const statuses = Object.values(checks).map(check => check.status);
    
    if (statuses.includes('fail')) {
      return 'critical';
    } else if (statuses.includes('warning')) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  private generateHealthRecommendations(checks: Record<string, HealthCheck>): string[] {
    const recommendations: string[] = [];
    
    Object.entries(checks).forEach(([checkName, check]) => {
      if (check.status === 'fail') {
        recommendations.push(`Fix ${checkName}: ${check.message}`);
      } else if (check.status === 'warning') {
        recommendations.push(`Review ${checkName}: ${check.message}`);
      }
    });
    
    if (recommendations.length === 0) {
      recommendations.push('All systems are healthy - no action required');
    }
    
    return recommendations;
  }
}
