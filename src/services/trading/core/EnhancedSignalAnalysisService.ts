import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { ServiceContainer } from './ServiceContainer';
import { SystemHealthChecker } from './SystemHealthChecker';
import { ValidationChain } from './ValidationChain';
import { PositionValidator } from './PositionValidator';

export class EnhancedSignalAnalysisService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private healthChecker: SystemHealthChecker;
  private positionValidator: PositionValidator;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = ServiceContainer.getLogger(userId);
    this.healthChecker = new SystemHealthChecker(userId, bybitService);
    this.positionValidator = new PositionValidator(userId);
  }

  async analyzeAndCreateSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n🧠 ===== ENHANCED SIGNAL ANALYSIS & CREATION =====');
      
      await this.logger.logSystemInfo('Starting signal analysis and creation', {
        tradingLogic: config.trading_logic_type,
        activePairs: config.trading_pairs.length,
        maxOrderAmount: config.max_order_amount_usd
      });

      // Perform health check but don't abort on warnings
      const healthReport = await this.healthChecker.performHealthCheck(config);
      console.log(`🏥 System health: ${healthReport.overall}`);

      if (healthReport.overall === 'critical') {
        console.warn('⚠️ System health is critical but continuing with limited functionality');
        await this.logger.logSystemInfo('Signal analysis continuing despite critical system health', {
          healthReport: healthReport.overall
        });
      }

      // Validate configuration
      const configValidation = ValidationChain.validateConfiguration(config);
      if (!configValidation.isValid) {
        console.error('❌ Configuration validation failed:', configValidation.errors);
        await this.logger.logError('Configuration validation failed', new Error(configValidation.errors.join(', ')));
        return;
      }

      if (configValidation.warnings.length > 0) {
        console.warn('⚠️ Configuration warnings:', configValidation.warnings);
      }

      console.log(`📊 Processing ${config.trading_pairs.length} trading pairs for signal analysis`);

      // Process each trading pair with position limit validation
      let signalsCreated = 0;
      for (const symbol of config.trading_pairs) {
        try {
          console.log(`\n📊 Analyzing ${symbol}...`);
          
          // Check position limits BEFORE creating signals
          const positionValidation = await this.positionValidator.validateWithDetailedLogging(symbol, config);
          
          if (!positionValidation.isValid) {
            console.log(`⚠️ Skipping ${symbol}: ${positionValidation.reason}`);
            console.log(`📊 Current state: ${positionValidation.currentPositions}/${positionValidation.limits.maxPositionsPerPair} positions, ${positionValidation.activePairs}/${positionValidation.limits.maxActivePairs} active pairs`);
            continue;
          }

          // Analyze market and create signals based on trading logic
          const signalCreated = await this.analyzeSymbolAndCreateSignal(symbol, config);
          
          if (signalCreated) {
            signalsCreated++;
            console.log(`✅ Signal created for ${symbol}`);
          } else {
            console.log(`📊 No signal needed for ${symbol} at this time`);
          }
          
        } catch (error) {
          console.error(`❌ Error analyzing ${symbol}:`, error);
          await this.logger.logError(`Signal analysis failed for ${symbol}`, error);
        }
      }

      console.log(`✅ Signal analysis complete - Created ${signalsCreated} signals`);
      
    } catch (error) {
      console.error('❌ Critical error in signal analysis:', error);
      await this.logger.logError('Critical error in signal analysis', error);
      throw error;
    }
  }

  private async analyzeSymbolAndCreateSignal(symbol: string, config: TradingConfigData): Promise<boolean> {
    try {
      console.log(`🔍 Analyzing ${symbol} for trading opportunities...`);
      
      // Get current market price
      const currentPrice = await this.getCurrentPrice(symbol);
      if (!currentPrice) {
        console.warn(`⚠️ Could not get price for ${symbol}`);
        return false;
      }

      console.log(`💰 Current price for ${symbol}: $${currentPrice}`);

      // Calculate support level based on trading logic
      const supportLevel = await this.calculateSupportLevel(symbol, currentPrice, config);
      if (!supportLevel) {
        console.log(`📊 No clear support level found for ${symbol}`);
        return false;
      }

      console.log(`📈 Support level for ${symbol}: $${supportLevel}`);

      // Check if current price is near support (within entry range)
      const entryThreshold = supportLevel * (1 + config.entry_offset_percent / 100);
      const isNearSupport = currentPrice <= entryThreshold;

      console.log(`🎯 Entry threshold: $${entryThreshold}, Near support: ${isNearSupport}`);

      if (isNearSupport) {
        // Create buy signal
        const dbHelper = ServiceContainer.getDatabaseHelper(this.userId);
        const signal = await dbHelper.createSignal({
          user_id: this.userId,
          symbol: symbol,
          signal_type: 'buy',
          price: supportLevel, // Use support level as entry price
          confidence: 0.8,
          reasoning: `${symbol} near support at $${supportLevel.toFixed(6)}, current price $${currentPrice.toFixed(6)} - ${config.trading_logic_type} analysis`
        });

        console.log(`✅ Buy signal created for ${symbol}: ID ${signal.id} at $${supportLevel}`);
        
        await this.logger.logSuccess(`Buy signal created for ${symbol}`, {
          signalId: signal.id,
          symbol,
          price: supportLevel,
          currentPrice,
          entryThreshold
        });

        return true;
      }

      return false;
      
    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
      await this.logger.logError(`Analysis failed for ${symbol}`, error);
      return false;
    }
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

  private async calculateSupportLevel(symbol: string, currentPrice: number, config: TradingConfigData): Promise<number | null> {
    try {
      // Implement support level calculation based on trading logic
      switch (config.trading_logic_type) {
        case 'logic1_base':
          // Simple percentage-based support
          return currentPrice * (1 - config.support_lower_bound_percent / 100);
          
        case 'logic2_data_driven':
          // More sophisticated analysis would go here
          // For now, use swing low analysis simulation
          const swingLowMultiplier = 0.95; // 5% below current price as swing low
          return currentPrice * swingLowMultiplier;
          
        default:
          return currentPrice * 0.98; // Default 2% below current price
      }
    } catch (error) {
      console.error(`Error calculating support for ${symbol}:`, error);
      return null;
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

      const healthReport = await this.healthChecker.performHealthCheck(config);
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
}
