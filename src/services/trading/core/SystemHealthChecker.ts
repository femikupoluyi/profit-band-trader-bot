
import { ServiceContainer } from './ServiceContainer';
import { ValidationChain } from './ValidationChain';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export interface SystemHealthReport {
  overall: 'healthy' | 'warning' | 'critical';
  checks: {
    database: { status: 'pass' | 'fail'; message: string };
    bybitConnection: { status: 'pass' | 'fail'; message: string };
    configuration: { status: 'pass' | 'fail'; message: string; errors?: string[] };
    services: { status: 'pass' | 'fail'; message: string };
    precision: { status: 'pass' | 'fail'; message: string };
  };
  timestamp: string;
}

export class SystemHealthChecker {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async performHealthCheck(config: TradingConfigData): Promise<SystemHealthReport> {
    console.log(`🏥 ===== SYSTEM HEALTH CHECK START =====`);
    
    const checks = {
      database: await this.checkDatabase(),
      bybitConnection: await this.checkBybitConnection(),
      configuration: await this.checkConfiguration(config),
      services: await this.checkServices(),
      precision: await this.checkPrecisionServices(config)
    };

    // Determine overall health
    const failedChecks = Object.values(checks).filter(check => check.status === 'fail');
    let overall: 'healthy' | 'warning' | 'critical';
    
    if (failedChecks.length === 0) {
      overall = 'healthy';
    } else if (failedChecks.length <= 2) {
      overall = 'warning';
    } else {
      overall = 'critical';
    }

    const report: SystemHealthReport = {
      overall,
      checks,
      timestamp: new Date().toISOString()
    };

    console.log(`🏥 Health Check Complete: ${overall.toUpperCase()}`);
    console.log(`📊 Passed: ${Object.values(checks).filter(c => c.status === 'pass').length}/5`);
    console.log(`❌ Failed: ${failedChecks.length}/5`);

    return report;
  }

  private async checkDatabase(): Promise<{ status: 'pass' | 'fail'; message: string }> {
    try {
      const dbHelper = ServiceContainer.getDatabaseHelper(this.userId);
      
      // Test basic database operations
      const signals = await dbHelper.getSignals(this.userId, { limit: 1 });
      const trades = await dbHelper.getTrades(this.userId, { limit: 1 });
      
      return {
        status: 'pass',
        message: `Database accessible. Found ${signals.length} recent signals, ${trades.length} recent trades.`
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Database connection failed: ${error.message}`
      };
    }
  }

  private async checkBybitConnection(): Promise<{ status: 'pass' | 'fail'; message: string }> {
    try {
      // Test basic Bybit API connectivity
      const response = await this.bybitService.getTickers('BTCUSDT');
      
      if (response.retCode === 0) {
        return {
          status: 'pass',
          message: 'Bybit API connection successful'
        };
      } else {
        return {
          status: 'fail',
          message: `Bybit API error: ${response.retMsg}`
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: `Bybit connection failed: ${error.message}`
      };
    }
  }

  private async checkConfiguration(config: TradingConfigData): Promise<{ status: 'pass' | 'fail'; message: string; errors?: string[] }> {
    try {
      const validation = ValidationChain.validateConfig(config);
      
      if (validation.isValid) {
        return {
          status: 'pass',
          message: `Configuration valid. Active pairs: ${config.trading_pairs.length}, Max order: $${config.max_order_amount_usd}`
        };
      } else {
        return {
          status: 'fail',
          message: `Configuration validation failed`,
          errors: validation.errors
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: `Configuration check failed: ${error.message}`
      };
    }
  }

  private async checkServices(): Promise<{ status: 'pass' | 'fail'; message: string }> {
    try {
      // Test service container instantiation
      const logger = ServiceContainer.getLogger(this.userId);
      const dbHelper = ServiceContainer.getDatabaseHelper(this.userId);
      const signalCore = ServiceContainer.getSignalAnalysisCore(this.userId);
      const orderExecution = ServiceContainer.getOrderExecution(this.userId, this.bybitService);
      
      // Test basic service functionality
      await logger.logSystemInfo('Health check test');
      
      return {
        status: 'pass',
        message: 'All core services initialized successfully'
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Service initialization failed: ${error.message}`
      };
    }
  }

  private async checkPrecisionServices(config: TradingConfigData): Promise<{ status: 'pass' | 'fail'; message: string }> {
    try {
      if (config.trading_pairs.length === 0) {
        return {
          status: 'fail',
          message: 'No trading pairs configured for precision testing'
        };
      }

      // Test precision formatting for first trading pair
      const testSymbol = config.trading_pairs[0];
      
      const validation = await ValidationChain.validateTrade(
        testSymbol,
        1.0, // test quantity
        100.0, // test price
        config
      );

      if (validation.isValid) {
        return {
          status: 'pass',
          message: `Precision services working. Tested with ${testSymbol}`
        };
      } else {
        return {
          status: 'fail',
          message: `Precision validation failed: ${validation.errors.join(', ')}`
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: `Precision services check failed: ${error.message}`
      };
    }
  }
}
