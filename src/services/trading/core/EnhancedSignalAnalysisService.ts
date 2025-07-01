
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { SignalAnalysisOrchestrator } from './SignalAnalysisOrchestrator';
import { ValidationChain } from './ValidationChain';
import { ServiceContainer } from './ServiceContainer';
import { TradingLogger } from './TradingLogger';

export class EnhancedSignalAnalysisService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private orchestrator: SignalAnalysisOrchestrator;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = ServiceContainer.getLogger(userId);
    this.orchestrator = new SignalAnalysisOrchestrator(userId, bybitService);
  }

  async analyzeAndCreateSignals(config: TradingConfigData): Promise<void> {
    return this.orchestrator.analyzeAndCreateSignals(config);
  }

  async createTestSignal(symbol: string, config: TradingConfigData): Promise<boolean> {
    try {
      console.log(`🧪 Creating test signal for ${symbol}`);
      
      const currentPrice = await this.getCurrentPrice(symbol);
      if (!currentPrice) {
        console.warn(`⚠️ Could not get price for ${symbol}`);
        return false;
      }

      const dbHelper = ServiceContainer.getDatabaseHelper(this.userId);
      const signal = await dbHelper.createSignal({
        user_id: this.userId,
        symbol: symbol,
        signal_type: 'buy',
        price: currentPrice,
        confidence: 0.5,
        reasoning: `Test signal for ${symbol} at $${currentPrice.toFixed(6)}`
      });

      console.log(`✅ Test signal created for ${symbol}: ID ${signal.id}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Error creating test signal for ${symbol}:`, error);
      return false;
    }
  }

  async analyzeSignalWithHealthCheck(signal: any, config: TradingConfigData): Promise<{
    isValid: boolean;
    healthStatus: 'healthy' | 'warning' | 'critical';
    analysis: any;
    recommendations: string[];
  }> {
    try {
      console.log(`🔍 ===== ENHANCED SIGNAL ANALYSIS START FOR ${signal.symbol} =====`);
      
      await this.logger.logSystemInfo('Starting enhanced signal analysis', {
        signalId: signal.id,
        symbol: signal.symbol,
        signalType: signal.signal_type
      });

      // Import health checker dynamically
      const { SystemHealthChecker } = await import('./SystemHealthChecker');
      const healthChecker = new SystemHealthChecker(this.userId, this.bybitService);
      const healthReport = await healthChecker.performHealthCheck(config);
      
      console.log(`🏥 System health status: ${healthReport.overall}`);
      
      const validation = ValidationChain.validateSignal(signal, config);
      
      if (!validation.isValid) {
        console.log(`❌ Signal validation failed: ${validation.errors.join(', ')}`);
        return {
          isValid: false,
          healthStatus: healthReport.overall,
          analysis: { validationErrors: validation.errors },
          recommendations: this.generateRecommendations(healthReport, validation.errors)
        };
      }

      const analysis = await this.performEnhancedAnalysis(signal, config, healthReport);
      
      console.log(`✅ Enhanced analysis complete for ${signal.symbol}`);
      
      await this.logger.logSuccess(`Enhanced signal analysis completed for ${signal.symbol}`, {
        signalId: signal.id,
        healthStatus: healthReport.overall,
        analysisResults: analysis
      });

      return {
        isValid: true,
        healthStatus: healthReport.overall,
        analysis,
        recommendations: this.generateRecommendations(healthReport, [])
      };

    } catch (error) {
      console.error(`❌ Error in enhanced signal analysis for ${signal.symbol}:`, error);
      await this.logger.logError(`Enhanced signal analysis failed for ${signal.symbol}`, error, {
        signalId: signal.id
      });
      
      return {
        isValid: false,
        healthStatus: 'critical',
        analysis: { error: error.message },
        recommendations: ['Fix system errors before proceeding with signal analysis']
      };
    }
  }

  private async performEnhancedAnalysis(signal: any, config: TradingConfigData, healthReport: any): Promise<any> {
    const analysis = {
      signal: {
        id: signal.id,
        symbol: signal.symbol,
        type: signal.signal_type,
        price: parseFloat(signal.price),
        confidence: signal.confidence,
        timestamp: signal.created_at
      },
      systemHealth: {
        overall: healthReport.overall,
        criticalIssues: Object.entries(healthReport.checks)
          .filter(([_, check]) => (check as any).status === 'fail')
          .length
      },
      riskAssessment: {
        maxOrderAmount: config.max_order_amount_usd,
        portfolioExposure: config.max_portfolio_exposure_percent,
        riskLevel: this.calculateRiskLevel(config, healthReport)
      },
      tradingContext: {
        activePairs: config.trading_pairs.length,
        maxPositionsPerPair: config.max_positions_per_pair,
        systemActive: config.is_active
      }
    };

    return analysis;
  }

  private calculateRiskLevel(config: TradingConfigData, healthReport: any): 'low' | 'medium' | 'high' {
    let riskScore = 0;
    
    if (healthReport.overall === 'critical') riskScore += 3;
    else if (healthReport.overall === 'warning') riskScore += 1;
    
    if (config.max_order_amount_usd > 500) riskScore += 2;
    if (config.max_portfolio_exposure_percent > 30) riskScore += 2;
    if (config.max_positions_per_pair > 2) riskScore += 1;
    
    if (riskScore >= 5) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  private generateRecommendations(healthReport: any, validationErrors: string[]): string[] {
    const recommendations: string[] = [];
    
    if (healthReport.overall === 'critical') {
      recommendations.push('Address critical system health issues before trading');
    }
    
    if (validationErrors.length > 0) {
      recommendations.push('Fix validation errors: ' + validationErrors.join(', '));
    }
    
    Object.entries(healthReport.checks).forEach(([checkName, check]: [string, any]) => {
      if (check.status === 'fail') {
        recommendations.push(`Fix ${checkName}: ${check.message}`);
      }
    });
    
    if (recommendations.length === 0) {
      recommendations.push('System appears healthy - proceed with normal trading operations');
    }
    
    return recommendations;
  }

  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const marketData = await this.bybitService.getMarketPrice(symbol);
      return marketData?.price || null;
    } catch (error) {
      console.error(`Error getting price for ${symbol}:`, error);
      return null;
    }
  }
}
