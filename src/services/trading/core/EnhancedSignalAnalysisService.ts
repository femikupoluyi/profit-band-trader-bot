import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { ServiceContainer } from './ServiceContainer';
import { SystemHealthChecker } from './SystemHealthChecker';
import { ValidationChain } from './ValidationChain';
import { PositionValidator } from './PositionValidator';
import { SupportResistanceService } from './SupportResistanceService';
import { DataDrivenSupportAnalyzer } from './DataDrivenSupportAnalyzer';
import { CandleDataService } from '../candleDataService';
import { SupportLevelProcessor } from './SupportLevelProcessor';
import { OrderDuplicationChecker } from './OrderDuplicationChecker';

export class EnhancedSignalAnalysisService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private healthChecker: SystemHealthChecker;
  private positionValidator: PositionValidator;
  private supportResistanceService: SupportResistanceService;
  private dataDrivenAnalyzer: DataDrivenSupportAnalyzer;
  private candleDataService: CandleDataService;
  private orderDuplicationChecker: OrderDuplicationChecker;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = ServiceContainer.getLogger(userId);
    this.healthChecker = new SystemHealthChecker(userId, bybitService);
    this.positionValidator = new PositionValidator(userId);
    this.supportResistanceService = new SupportResistanceService(bybitService);
    this.dataDrivenAnalyzer = new DataDrivenSupportAnalyzer();
    this.candleDataService = new CandleDataService();
    this.orderDuplicationChecker = new OrderDuplicationChecker(userId);
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
      console.log(`\n🔍 ===== ENHANCED ANALYSIS FOR ${symbol} =====`);
      
      // Get current market price
      const currentPrice = await this.getCurrentPrice(symbol);
      if (!currentPrice) {
        console.warn(`⚠️ Could not get price for ${symbol}`);
        return false;
      }

      console.log(`💰 Current price for ${symbol}: $${currentPrice.toFixed(6)}`);

      // Analyze support levels using historical data
      const supportAnalysis = await this.performSupportAnalysis(symbol, currentPrice, config);
      if (!supportAnalysis.isValid) {
        console.log(`📊 No valid support found for ${symbol}: ${supportAnalysis.reason}`);
        return false;
      }

      const supportPrice = supportAnalysis.supportLevel!;
      console.log(`📈 Support level identified for ${symbol}: $${supportPrice.toFixed(6)} (strength: ${supportAnalysis.strength})`);

      // FIXED: Check for order duplication and validate support level placement
      const orderValidation = await this.orderDuplicationChecker.validateOrderPlacement(symbol, supportPrice, config);
      
      if (!orderValidation.canPlaceOrder) {
        console.log(`❌ ${symbol}: Order placement blocked - ${orderValidation.reason}`);
        return false;
      }

      if (orderValidation.isSecondOrder) {
        console.log(`📊 ${symbol}: This will be a second order (EOD scenario) with lower support level`);
      }

      // FIXED: Calculate entry price with proper offset ABOVE support level
      const entryOffsetPercent = config.entry_offset_percent || 0.5;
      const entryPrice = supportPrice * (1 + entryOffsetPercent / 100);
      
      console.log(`📊 Entry price calculation for ${symbol}:`);
      console.log(`  - Support Level: $${supportPrice.toFixed(6)}`);
      console.log(`  - Entry Offset: +${entryOffsetPercent}%`);
      console.log(`  - Entry Price: $${entryPrice.toFixed(6)} (${entryOffsetPercent}% above support)`);

      // Validate entry price is reasonable compared to current market
      const priceDistancePercent = ((currentPrice - entryPrice) / currentPrice) * 100;
      
      if (priceDistancePercent < 0.1) {
        console.log(`📊 ${symbol}: Entry price too close to current price (${priceDistancePercent.toFixed(2)}% below)`);
        return false;
      }

      if (priceDistancePercent > 15) {
        console.log(`📊 ${symbol}: Entry price too far from current price (${priceDistancePercent.toFixed(2)}% below)`);
        return false;
      }

      // Format entry price with proper precision
      const formattedEntryPrice = await SupportLevelProcessor.formatSupportLevel(symbol, entryPrice);

      // Create buy signal at calculated entry price (support + offset)
      const dbHelper = ServiceContainer.getDatabaseHelper(this.userId);
      const signal = await dbHelper.createSignal({
        user_id: this.userId,
        symbol: symbol,
        signal_type: 'buy',
        price: formattedEntryPrice,
        confidence: supportAnalysis.strength!,
        reasoning: `${symbol} LIMIT BUY at $${formattedEntryPrice.toFixed(6)} (${entryOffsetPercent}% above support $${supportPrice.toFixed(6)}, ${priceDistancePercent.toFixed(2)}% below market $${currentPrice.toFixed(6)}) - ${config.trading_logic_type} analysis${orderValidation.isSecondOrder ? ' (Second Order - EOD)' : ''}`
      });

      console.log(`✅ ENTRY OFFSET buy signal created for ${symbol}: ID ${signal.id}`);
      console.log(`📊 Signal Details:`);
      console.log(`  - Support: $${supportPrice.toFixed(6)}`);
      console.log(`  - Entry: $${formattedEntryPrice.toFixed(6)} (+${entryOffsetPercent}% above support)`);
      console.log(`  - Market: $${currentPrice.toFixed(6)} (${priceDistancePercent.toFixed(2)}% above entry)`);
      console.log(`  - Order Type: ${orderValidation.isSecondOrder ? 'Second Order (EOD)' : 'First Order'}`);
      
      await this.logger.logSuccess(`Entry offset buy signal created for ${symbol}`, {
        signalId: signal.id,
        symbol,
        supportPrice,
        entryPrice: formattedEntryPrice,
        currentPrice,
        entryOffsetPercent,
        priceDistancePercent,
        supportStrength: supportAnalysis.strength,
        tradingLogic: config.trading_logic_type,
        isSecondOrder: orderValidation.isSecondOrder,
        existingOrders: orderValidation.existingOrders.length
      });

      return true;
      
    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
      await this.logger.logError(`Analysis failed for ${symbol}`, error);
      return false;
    }
  }

  private async performSupportAnalysis(symbol: string, currentPrice: number, config: TradingConfigData): Promise<{
    isValid: boolean;
    supportLevel?: number;
    strength?: number;
    touchCount?: number;
    reason?: string;
  }> {
    try {
      console.log(`🔍 Performing ${config.trading_logic_type} support analysis for ${symbol}`);

      if (config.trading_logic_type === 'logic2_data_driven') {
        return await this.performDataDrivenAnalysis(symbol, currentPrice, config);
      } else {
        return await this.performBasicAnalysis(symbol, currentPrice, config);
      }
    } catch (error) {
      console.error(`❌ Error in support analysis for ${symbol}:`, error);
      return { isValid: false, reason: `Analysis error: ${error.message}` };
    }
  }

  private async performDataDrivenAnalysis(symbol: string, currentPrice: number, config: TradingConfigData): Promise<{
    isValid: boolean;
    supportLevel?: number;
    strength?: number;
    touchCount?: number;
    reason?: string;
  }> {
    try {
      console.log(`🧠 Data-driven analysis for ${symbol}`);
      
      // Get historical candle data
      const candles = await this.candleDataService.getCandleData(symbol, config.support_candle_count || 128);
      
      if (candles.length < 20) {
        console.warn(`⚠️ Insufficient candle data for ${symbol}: ${candles.length} candles`);
        // Fallback to support/resistance service
        return await this.useSupportResistanceService(symbol, currentPrice, config);
      }

      // Use DataDrivenSupportAnalyzer
      const supportLevels = this.dataDrivenAnalyzer.analyzeSupport(candles, config);
      
      if (supportLevels.length === 0) {
        console.log(`📊 No support levels found by data-driven analysis for ${symbol}`);
        // Fallback to support/resistance service
        return await this.useSupportResistanceService(symbol, currentPrice, config);
      }

      // Get the strongest support level
      const bestSupport = supportLevels[0];
      console.log(`📈 Data-driven support for ${symbol}: $${bestSupport.price.toFixed(6)} (strength: ${bestSupport.strength.toFixed(3)}, touches: ${bestSupport.touches})`);

      return {
        isValid: true,
        supportLevel: bestSupport.price,
        strength: bestSupport.strength,
        touchCount: bestSupport.touches
      };

    } catch (error) {
      console.error(`❌ Data-driven analysis failed for ${symbol}:`, error);
      // Fallback to basic analysis
      return await this.performBasicAnalysis(symbol, currentPrice, config);
    }
  }

  private async performBasicAnalysis(symbol: string, currentPrice: number, config: TradingConfigData): Promise<{
    isValid: boolean;
    supportLevel?: number;
    strength?: number;
    touchCount?: number;
    reason?: string;
  }> {
    try {
      console.log(`📊 Basic support analysis for ${symbol}`);
      
      // Try support/resistance service first
      const serviceResult = await this.useSupportResistanceService(symbol, currentPrice, config);
      if (serviceResult.isValid) {
        return serviceResult;
      }

      // Fallback to percentage-based support
      const supportPercent = config.support_lower_bound_percent || 2.0;
      const supportLevel = currentPrice * (1 - supportPercent / 100);
      
      console.log(`📈 Basic support for ${symbol}: $${supportLevel.toFixed(6)} (${supportPercent}% below current price)`);

      return {
        isValid: true,
        supportLevel,
        strength: 0.6, // Default strength for basic analysis
        touchCount: 2
      };

    } catch (error) {
      console.error(`❌ Basic analysis failed for ${symbol}:`, error);
      return { isValid: false, reason: `Basic analysis error: ${error.message}` };
    }
  }

  private async useSupportResistanceService(symbol: string, currentPrice: number, config: TradingConfigData): Promise<{
    isValid: boolean;
    supportLevel?: number;
    strength?: number;
    touchCount?: number;
    reason?: string;
  }> {
    try {
      console.log(`🔑 Using SupportResistanceService for ${symbol}`);
      
      const analysis = await this.supportResistanceService.getSupportResistanceLevels(
        symbol,
        config.chart_timeframe || '4h',
        config.support_candle_count || 128,
        config.support_lower_bound_percent || 5.0,
        config.support_upper_bound_percent || 2.0
      );

      if (!analysis.currentSupport) {
        console.log(`📊 No support found by SupportResistanceService for ${symbol}`);
        return { isValid: false, reason: 'No support levels identified from historical data' };
      }

      const supportLevel = analysis.currentSupport.price;
      const volume = analysis.currentSupport.volume;
      
      // Calculate strength based on volume and position relative to bounds
      const strength = Math.min(0.9, 0.3 + (volume / 1000000) * 0.6); // Volume-based strength
      
      console.log(`🔑 SupportResistanceService found support for ${symbol}: $${supportLevel.toFixed(6)} (volume: ${volume}, strength: ${strength.toFixed(3)})`);

      return {
        isValid: true,
        supportLevel,
        strength,
        touchCount: 3 // Estimate based on service analysis
      };

    } catch (error) {
      console.error(`❌ SupportResistanceService failed for ${symbol}:`, error);
      return { isValid: false, reason: `Service error: ${error.message}` };
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

  async createTestSignal(symbol: string, config: TradingConfigData): Promise<boolean> {
    try {
      console.log(`🧪 Creating test signal for ${symbol}`);
      
      // Get current market price
      const currentPrice = await this.getCurrentPrice(symbol);
      if (!currentPrice) {
        console.warn(`⚠️ Could not get price for ${symbol}`);
        return false;
      }

      // Create a simple test signal at current price
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
