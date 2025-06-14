
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SignalAnalysisCore } from './SignalAnalysisCore';
import { AveragingDownAnalyzer } from './AveragingDownAnalyzer';
import { NewPositionAnalyzer } from './NewPositionAnalyzer';
import { SignalCreationService } from './SignalCreationService';

export interface SignalAnalysisResult {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  entryPrice: number;
  quantity: number;
  reasoning: string;
  supportLevel?: number;
  trend?: string;
  orderValue: number;
  isAveragingDown?: boolean;
}

export class EnhancedSignalAnalysisService {
  private userId: string;
  private bybitService: BybitService;
  private signalCore: SignalAnalysisCore;
  private averagingAnalyzer: AveragingDownAnalyzer;
  private newPositionAnalyzer: NewPositionAnalyzer;
  private signalCreator: SignalCreationService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.signalCore = new SignalAnalysisCore(userId);
    this.averagingAnalyzer = new AveragingDownAnalyzer();
    this.newPositionAnalyzer = new NewPositionAnalyzer(userId, bybitService);
    this.signalCreator = new SignalCreationService(userId);
  }

  async analyzeAndCreateSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n🧠 ===== ENHANCED SIGNAL ANALYSIS START =====');
      console.log(`🎯 Trading Logic: ${config.trading_logic_type}`);
      console.log(`📊 Trading Pairs: ${config.trading_pairs.join(', ')}`);

      for (const symbol of config.trading_pairs) {
        try {
          console.log(`\n🔍 Analyzing ${symbol}...`);
          const result = await this.analyzeSignal(symbol, config);
          
          if (result && result.action !== 'hold') {
            console.log(`✅ Generated ${result.action} signal for ${symbol} ${result.isAveragingDown ? '(AVERAGING DOWN)' : '(NEW POSITION)'}`);
            await this.storeSignal(result, config);
          } else {
            console.log(`⚠️ No signal generated for ${symbol}`);
          }
        } catch (error) {
          console.error(`❌ Error analyzing ${symbol}:`, error);
        }
      }

      console.log('✅ ===== ENHANCED SIGNAL ANALYSIS COMPLETE =====');
    } catch (error) {
      console.error('❌ Error in enhanced signal analysis:', error);
      throw error;
    }
  }

  async analyzeSignal(symbol: string, config: TradingConfigData): Promise<SignalAnalysisResult | null> {
    try {
      console.log(`🔍 Starting enhanced analysis for ${symbol}`);

      // Get signal context
      const context = await this.signalCore.getSignalContext(symbol, config);
      if (!context) {
        return null;
      }

      // Get current market price
      const marketPrice = await this.bybitService.getMarketPrice(symbol);
      if (!marketPrice || !marketPrice.price || marketPrice.price <= 0) {
        console.error(`❌ Invalid market price for ${symbol}`);
        return null;
      }

      const currentPrice = marketPrice.price;
      context.currentPrice = currentPrice;

      console.log(`📊 ${symbol}: Current price: ${currentPrice} - ${context.isAveragingDown ? 'AVERAGING DOWN' : 'NEW POSITION'} scenario`);

      let analysisResult;

      if (context.isAveragingDown) {
        // Analyze averaging down scenario
        analysisResult = this.averagingAnalyzer.analyzeAveragingDown(context, currentPrice, config);
      } else {
        // Analyze new position scenario
        analysisResult = await this.newPositionAnalyzer.analyzeNewPosition(context, currentPrice, config);
      }

      if (!analysisResult.shouldCreateSignal) {
        return null;
      }

      // Calculate quantity (this would typically be done in the signal creation service,
      // but we need it for the return value of this method)
      const quantity = await this.calculateQuantityForResult(symbol, config.max_order_amount_usd || 100, analysisResult.entryPrice!, config);
      const orderValue = quantity * analysisResult.entryPrice!;

      console.log(`✅ Generated ${context.isAveragingDown ? 'AVERAGING DOWN' : 'NEW POSITION'} signal for ${symbol}:`, {
        entryPrice: analysisResult.entryPrice,
        quantity: quantity,
        orderValue: orderValue.toFixed(2),
        confidence: analysisResult.confidence
      });

      return {
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

    } catch (error) {
      console.error(`❌ Error in enhanced signal analysis for ${symbol}:`, error);
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
}
