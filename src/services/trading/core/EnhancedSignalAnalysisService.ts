
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SignalAnalysisCore, SignalContext } from './SignalAnalysisCore';
import { AveragingDownAnalyzer } from './AveragingDownAnalyzer';
import { NewPositionAnalyzer } from './NewPositionAnalyzer';
import { SignalCreationService } from './SignalCreationService';
import { SystemHealthChecker } from './SystemHealthChecker';
import { TradingLogger } from './TradingLogger';
import { SignalAnalysisResult } from './TypeDefinitions';

export class EnhancedSignalAnalysisService {
  private userId: string;
  private bybitService: BybitService;
  private signalCore: SignalAnalysisCore;
  private averagingAnalyzer: AveragingDownAnalyzer;
  private newPositionAnalyzer: NewPositionAnalyzer;
  private signalCreator: SignalCreationService;
  private healthChecker: SystemHealthChecker;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.signalCore = new SignalAnalysisCore(userId);
    this.averagingAnalyzer = new AveragingDownAnalyzer();
    this.newPositionAnalyzer = new NewPositionAnalyzer(userId, bybitService);
    this.signalCreator = new SignalCreationService(userId);
    this.healthChecker = new SystemHealthChecker(userId, bybitService);
    this.logger = new TradingLogger(userId);
  }

  async analyzeAndCreateSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n🧠 ===== ENHANCED SIGNAL ANALYSIS START =====');
      console.log(`🎯 Trading Logic: ${config.trading_logic_type}`);
      console.log(`📊 Trading Pairs: ${config.trading_pairs.join(', ')}`);
      console.log(`⚙️ Configuration Active: ${config.is_active ? 'YES' : 'NO'}`);
      console.log(`💰 Max Order Amount: $${config.max_order_amount_usd}`);
      console.log(`🎯 Take Profit: ${config.take_profit_percent}%`);
      console.log(`📈 Entry Offset: ${config.entry_offset_percent}%`);
      console.log(`🔄 Max Positions Per Pair: ${config.max_positions_per_pair}`);

      await this.logger.logSystemInfo('Starting enhanced signal analysis', {
        tradingLogicType: config.trading_logic_type,
        tradingPairs: config.trading_pairs,
        configurationActive: config.is_active,
        maxOrderAmount: config.max_order_amount_usd
      });

      // ENHANCED: System health check with comprehensive logging
      console.log('\n🏥 ===== COMPREHENSIVE SYSTEM HEALTH CHECK =====');
      const healthCheck = await this.healthChecker.performComprehensiveHealthCheck(config);
      
      if (!healthCheck.isHealthy) {
        console.error('❌ System health check failed:', healthCheck.issues);
        console.log('📋 Health check details:', healthCheck.details);
        await this.logger.logError('System health check failed', new Error('Health check failed'), healthCheck);
        return;
      }

      console.log('✅ System health check passed - all systems operational');

      if (!config.is_active) {
        console.log('⚠️ Trading configuration is INACTIVE - skipping signal analysis');
        await this.logger.logSystemInfo('Signal analysis skipped - configuration inactive');
        return;
      }

      let analysisStats = {
        totalPairs: config.trading_pairs.length,
        analyzedPairs: 0,
        signalsGenerated: 0,
        signalsRejected: 0,
        marketDataErrors: 0,
        analysisErrors: 0,
        rejectionReasons: {} as Record<string, number>
      };

      for (const symbol of config.trading_pairs) {
        try {
          console.log(`\n🔍 ===== ANALYZING ${symbol} =====`);
          analysisStats.analyzedPairs++;
          
          const result = await this.analyzeSymbolWithDetailedLogging(symbol, config);
          
          if (result && result.action !== 'hold') {
            console.log(`✅ Generated ${result.action} signal for ${symbol} ${result.isAveragingDown ? '(AVERAGING DOWN)' : '(NEW POSITION)'}`);
            console.log(`📊 Signal Details: price=${result.entryPrice}, quantity=${result.quantity}, confidence=${result.confidence}`);
            
            await this.storeSignal(result, config);
            analysisStats.signalsGenerated++;
          } else {
            console.log(`⚠️ No signal generated for ${symbol} - analysis returned hold or null`);
            analysisStats.signalsRejected++;
            
            const reason = result ? 'Analysis returned hold' : 'Analysis failed';
            analysisStats.rejectionReasons[reason] = (analysisStats.rejectionReasons[reason] || 0) + 1;
          }
        } catch (error) {
          analysisStats.analysisErrors++;
          console.error(`❌ Error analyzing ${symbol}:`, error);
          await this.logger.logError(`Failed to analyze ${symbol}`, error, { symbol });
          
          analysisStats.rejectionReasons['Analysis error'] = (analysisStats.rejectionReasons['Analysis error'] || 0) + 1;
        }
      }

      console.log('\n📊 ===== ENHANCED SIGNAL ANALYSIS SUMMARY =====');
      console.log('📈 Analysis Statistics:', analysisStats);
      console.log('📋 Detailed Rejection Breakdown:', analysisStats.rejectionReasons);
      
      await this.logger.logSystemInfo('Enhanced signal analysis completed', {
        ...analysisStats,
        tradingLogicUsed: config.trading_logic_type,
        configurationSnapshot: {
          isActive: config.is_active,
          tradingPairs: config.trading_pairs,
          maxOrderAmount: config.max_order_amount_usd
        }
      });

      console.log('✅ ===== ENHANCED SIGNAL ANALYSIS COMPLETE =====');
    } catch (error) {
      console.error('❌ Critical error in enhanced signal analysis:', error);
      await this.logger.logError('Critical error in enhanced signal analysis', error);
      throw error;
    }
  }

  private async analyzeSymbolWithDetailedLogging(symbol: string, config: TradingConfigData): Promise<SignalAnalysisResult | null> {
    try {
      console.log(`\n🔍 ===== DETAILED ANALYSIS FOR ${symbol} =====`);
      console.log(`📊 Step 1: Getting signal context for ${symbol}...`);

      // Get signal context with enhanced logging
      const context = await this.signalCore.getSignalContext(symbol, config);
      if (!context) {
        console.log(`❌ ${symbol}: Could not get signal context`);
        return null;
      }

      console.log(`✅ ${symbol}: Signal context obtained`);
      console.log(`📊 ${symbol}: Context details:`, {
        hasExistingPositions: context.existingPositions?.length > 0 || false,
        isAveragingDown: context.isAveragingDown || false,
        maxPositionsReached: context.maxPositionsReached || false
      });

      // Get current market price with enhanced logging
      console.log(`📊 Step 2: Getting market price for ${symbol}...`);
      const marketPrice = await this.bybitService.getMarketPrice(symbol);
      
      if (!marketPrice || !marketPrice.price || marketPrice.price <= 0) {
        console.log(`❌ ${symbol}: Invalid market price - price=${marketPrice?.price}`);
        return null;
      }

      const currentPrice = marketPrice.price;
      context.currentPrice = currentPrice;
      
      console.log(`✅ ${symbol}: Market price obtained: $${currentPrice}`);
      console.log(`🔄 ${symbol}: Analysis type: ${context.isAveragingDown ? 'AVERAGING DOWN' : 'NEW POSITION'}`);

      // Perform analysis based on scenario
      console.log(`📊 Step 3: Performing ${context.isAveragingDown ? 'averaging down' : 'new position'} analysis...`);
      
      let analysisResult;

      if (context.isAveragingDown) {
        console.log(`🔄 ${symbol}: Running averaging down analysis...`);
        analysisResult = this.averagingAnalyzer.analyzeAveragingDown(context, currentPrice, config);
        console.log(`📊 ${symbol}: Averaging down analysis result:`, {
          shouldCreateSignal: analysisResult.shouldCreateSignal,
          reasoning: analysisResult.reasoning,
          entryPrice: analysisResult.entryPrice,
          confidence: analysisResult.confidence
        });
      } else {
        console.log(`🆕 ${symbol}: Running new position analysis...`);
        analysisResult = await this.newPositionAnalyzer.analyzeNewPosition(context, currentPrice, config);
        console.log(`📊 ${symbol}: New position analysis result:`, {
          shouldCreateSignal: analysisResult.shouldCreateSignal,
          reasoning: analysisResult.reasoning,
          entryPrice: analysisResult.entryPrice,
          confidence: analysisResult.confidence
        });
      }

      if (!analysisResult.shouldCreateSignal) {
        console.log(`⚠️ ${symbol}: Analysis determined no signal should be created - ${analysisResult.reasoning}`);
        return null;
      }

      // Calculate quantity
      console.log(`📊 Step 4: Calculating quantity for ${symbol}...`);
      const quantity = await this.calculateQuantityForResult(symbol, config.max_order_amount_usd || 100, analysisResult.entryPrice!, config);
      const orderValue = quantity * analysisResult.entryPrice!;

      console.log(`✅ ${symbol}: Quantity calculated - qty=${quantity}, value=$${orderValue.toFixed(2)}`);

      const result: SignalAnalysisResult = {
        symbol,
        action: 'buy',
        confidence: analysisResult.confidence!,
        entryPrice: analysisResult.entryPrice!,
        quantity,
        reasoning: analysisResult.reasoning!,
        supportLevel: analysisResult.supportLevel,
        orderValue,
        isAveragingDown: context.isAveragingDown
      };

      console.log(`✅ ${symbol}: Analysis complete - Signal will be generated`);
      console.log(`📊 ${symbol}: Final signal details:`, {
        action: result.action,
        entryPrice: result.entryPrice,
        quantity: result.quantity,
        confidence: result.confidence,
        orderValue: result.orderValue,
        isAveragingDown: result.isAveragingDown
      });

      return result;

    } catch (error) {
      console.error(`❌ Error in detailed analysis for ${symbol}:`, error);
      await this.logger.logError(`Detailed analysis failed for ${symbol}`, error, { symbol });
      return null;
    }
  }

  private async calculateQuantityForResult(symbol: string, orderAmount: number, entryPrice: number, config: TradingConfigData): Promise<number> {
    // Simple quantity calculation for the result - the actual validation happens in SignalCreationService
    return orderAmount / entryPrice;
  }

  private async storeSignal(signal: SignalAnalysisResult, config: TradingConfigData): Promise<void> {
    try {
      const signalResult = await this.signalCreator.createSignal({
        symbol: signal.symbol,
        entryPrice: signal.entryPrice,
        confidence: signal.confidence,
        reasoning: signal.reasoning,
        isAveragingDown: signal.isAveragingDown || false
      }, config);

      if (signalResult.success) {
        console.log(`✅ Signal stored for ${signal.symbol}: ${signal.action} at ${signal.entryPrice} ${signal.isAveragingDown ? '(AVERAGING DOWN)' : '(NEW POSITION)'}`);
      } else {
        console.error(`❌ Failed to store signal for ${signal.symbol}: ${signalResult.reason}`);
      }
    } catch (error) {
      console.error('Error storing signal in database:', error);
      throw error;
    }
  }

  // TESTING: Method to create a simple test signal for pipeline verification
  async createTestSignal(symbol: string, config: TradingConfigData): Promise<boolean> {
    try {
      console.log(`\n🧪 ===== CREATING TEST SIGNAL FOR ${symbol} =====`);
      
      // Get current market price
      const marketPrice = await this.bybitService.getMarketPrice(symbol);
      if (!marketPrice || !marketPrice.price) {
        console.log(`❌ Cannot get market price for ${symbol}`);
        return false;
      }

      // Create a simple test signal
      const testSignal: SignalAnalysisResult = {
        symbol,
        action: 'buy',
        confidence: 0.75,
        entryPrice: marketPrice.price * 0.999, // Slightly below current price
        quantity: (config.max_order_amount_usd || 100) / marketPrice.price,
        reasoning: 'Test signal for pipeline verification',
        orderValue: config.max_order_amount_usd || 100,
        isAveragingDown: false
      };

      console.log(`🧪 Test signal created:`, testSignal);
      
      await this.storeSignal(testSignal, config);
      console.log(`✅ Test signal stored successfully for ${symbol}`);
      
      return true;
    } catch (error) {
      console.error(`❌ Error creating test signal for ${symbol}:`, error);
      return false;
    }
  }
}
