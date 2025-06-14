
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';
import { TradingLogicFactory } from './TradingLogicFactory';
import { SignalAnalysisCore } from './SignalAnalysisCore';
import { AveragingDownAnalyzer } from './AveragingDownAnalyzer';
import { NewPositionAnalyzer } from './NewPositionAnalyzer';
import { SignalCreationService } from './SignalCreationService';

export class SignalAnalysisService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private signalCore: SignalAnalysisCore;
  private averagingAnalyzer: AveragingDownAnalyzer;
  private newPositionAnalyzer: NewPositionAnalyzer;
  private signalCreator: SignalCreationService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.signalCore = new SignalAnalysisCore(userId);
    this.averagingAnalyzer = new AveragingDownAnalyzer();
    this.newPositionAnalyzer = new NewPositionAnalyzer(userId, bybitService);
    this.signalCreator = new SignalCreationService(userId);
    this.bybitService.setLogger(this.logger);
  }

  async analyzeAndCreateSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n📈 ===== SIGNAL ANALYSIS START =====');
      console.log('🔧 Configuration Details:', {
        tradingLogicType: config.trading_logic_type,
        tradingPairs: config.trading_pairs,
        maxOrderAmount: config.max_order_amount_usd,
        takeProfitPercent: config.take_profit_percent,
        entryOffsetPercent: config.entry_offset_percent,
        supportLowerBound: config.support_lower_bound_percent,
        supportUpperBound: config.support_upper_bound_percent,
        maxPositionsPerPair: config.max_positions_per_pair,
        supportCandleCount: config.support_candle_count
      });

      const tradingLogic = TradingLogicFactory.getLogic(config.trading_logic_type);
      console.log(`🧠 Using Trading Logic: ${tradingLogic.name}`);
      console.log(`📋 Logic Description: ${tradingLogic.description}`);
      
      await this.logger.logSuccess('Starting comprehensive signal analysis', {
        tradingLogicType: config.trading_logic_type,
        tradingLogicName: tradingLogic.name,
        tradingPairsCount: config.trading_pairs.length,
        tradingPairs: config.trading_pairs,
        maxOrderAmount: config.max_order_amount_usd,
        takeProfitPercent: config.take_profit_percent,
        configDetails: {
          entryOffsetPercent: config.entry_offset_percent,
          supportBounds: {
            lower: config.support_lower_bound_percent,
            upper: config.support_upper_bound_percent
          },
          maxPositionsPerPair: config.max_positions_per_pair
        }
      });

      let analysisResults = {
        totalPairs: config.trading_pairs.length,
        analyzedPairs: 0,
        signalsGenerated: 0,
        signalsRejected: 0,
        errors: 0,
        rejectionReasons: {} as Record<string, number>
      };

      for (const symbol of config.trading_pairs) {
        try {
          console.log(`\n🎯 ===== STARTING ANALYSIS FOR ${symbol} =====`);
          analysisResults.analyzedPairs++;
          const result = await this.analyzeSymbol(symbol, config, tradingLogic);
          if (result.signalGenerated) {
            analysisResults.signalsGenerated++;
            console.log(`✅ ${symbol}: Signal generated successfully`);
          } else {
            analysisResults.signalsRejected++;
            console.log(`❌ ${symbol}: Signal rejected - ${result.reason}`);
            
            const reason = result.reason || 'Unknown';
            analysisResults.rejectionReasons[reason] = (analysisResults.rejectionReasons[reason] || 0) + 1;
          }
        } catch (error) {
          analysisResults.errors++;
          console.error(`❌ Error analyzing ${symbol}:`, error);
          await this.logger.logError(`Failed to analyze ${symbol}`, error, { symbol });
        }
      }

      console.log('\n📊 ===== SIGNAL ANALYSIS SUMMARY =====');
      console.log('📈 Overall Results:', analysisResults);
      console.log('📋 Rejection Breakdown:', analysisResults.rejectionReasons);
      
      await this.logger.logSuccess('Signal analysis completed', {
        ...analysisResults,
        detailedBreakdown: analysisResults.rejectionReasons
      });
    } catch (error) {
      console.error('❌ Error in signal analysis:', error);
      await this.logger.logError('Error in signal analysis', error);
      throw error;
    }
  }

  private async analyzeSymbol(symbol: string, config: TradingConfigData, tradingLogic: any): Promise<{ signalGenerated: boolean; reason?: string }> {
    try {
      console.log(`\n🔍 ===== DETAILED ANALYSIS FOR ${symbol} =====`);
      await this.logger.logSystemInfo(`Starting detailed analysis for ${symbol}`);

      // Get signal context
      const context = await this.signalCore.getSignalContext(symbol, config);
      if (!context) {
        return { signalGenerated: false, reason: 'Could not get signal context' };
      }

      // Get current market price
      console.log(`📊 Step 2: Getting current market price for ${symbol}...`);
      const marketData = await this.bybitService.getMarketPrice(symbol);
      const currentPrice = marketData.price;
      context.currentPrice = currentPrice;
      
      console.log(`💰 ${symbol}: Current market price: ${currentPrice}`);
      console.log(`🔄 ${symbol}: ${context.isAveragingDown ? 'AVERAGING DOWN scenario' : 'NEW POSITION scenario'}`);

      let analysisResult;

      if (context.isAveragingDown) {
        // Analyze averaging down scenario
        analysisResult = this.averagingAnalyzer.analyzeAveragingDown(context, currentPrice, config);
      } else {
        // Analyze new position scenario
        analysisResult = await this.newPositionAnalyzer.analyzeNewPosition(context, currentPrice, config);
      }

      if (!analysisResult.shouldCreateSignal) {
        return { signalGenerated: false, reason: 'Analysis conditions not met' };
      }

      // Create the signal
      const signalResult = await this.signalCreator.createSignal({
        symbol,
        entryPrice: analysisResult.entryPrice!,
        confidence: analysisResult.confidence!,
        reasoning: analysisResult.reasoning!,
        isAveragingDown: context.isAveragingDown
      }, config);

      return { 
        signalGenerated: signalResult.success, 
        reason: signalResult.reason || 'Signal created successfully' 
      };

    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
      await this.logger.logError(`Failed to analyze ${symbol}`, error, { symbol });
      return { signalGenerated: false, reason: `Analysis error: ${error.message}` };
    }
  }
}
