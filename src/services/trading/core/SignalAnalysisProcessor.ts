
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { ServiceContainer } from './ServiceContainer';
import { SupportLevelProcessor } from './SupportLevelProcessor';
import { OrderDuplicationChecker } from './OrderDuplicationChecker';
import { SupportAnalysisService } from './SupportAnalysisService';

export class SignalAnalysisProcessor {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private orderDuplicationChecker: OrderDuplicationChecker;
  private supportAnalysisService: SupportAnalysisService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = ServiceContainer.getLogger(userId);
    this.orderDuplicationChecker = new OrderDuplicationChecker(userId);
    this.supportAnalysisService = new SupportAnalysisService(userId, bybitService);
  }

  async analyzeSymbolAndCreateSignal(symbol: string, config: TradingConfigData): Promise<boolean> {
    try {
      console.log(`\n🔍 ===== ENHANCED ANALYSIS FOR ${symbol} =====`);
      
      // Get current market price
      const currentPrice = await this.getCurrentPrice(symbol);
      if (!currentPrice) {
        console.warn(`⚠️ Could not get price for ${symbol}`);
        return false;
      }

      console.log(`💰 Current price for ${symbol}: $${currentPrice.toFixed(6)}`);

      // Perform enhanced support analysis
      const supportAnalysis = await this.supportAnalysisService.performEnhancedSupportAnalysis(symbol, currentPrice, config);
      if (!supportAnalysis.isValid) {
        console.log(`📊 No valid support found for ${symbol}: ${supportAnalysis.reason}`);
        return false;
      }

      const supportPrice = supportAnalysis.supportLevel!;
      console.log(`📈 Support level identified for ${symbol}: $${supportPrice.toFixed(6)} (strength: ${supportAnalysis.strength})`);

      // Check order duplication
      const orderValidation = await this.orderDuplicationChecker.validateOrderPlacement(symbol, supportPrice, config);
      
      if (!orderValidation.canPlaceOrder) {
        console.log(`❌ ${symbol}: Order placement blocked - ${orderValidation.reason}`);
        return false;
      }

      // Calculate entry price
      const entryOffsetPercent = Math.max(config.entry_offset_percent || 0.5, 0.5);
      const entryPrice = supportPrice * (1 + entryOffsetPercent / 100);
      
      console.log(`📊 Entry price calculation for ${symbol}:`);
      console.log(`  - Support Level: $${supportPrice.toFixed(6)}`);
      console.log(`  - Entry Offset: +${entryOffsetPercent}%`);
      console.log(`  - Entry Price: $${entryPrice.toFixed(6)}`);

      // Validate entry price distance
      const priceDistancePercent = ((currentPrice - entryPrice) / currentPrice) * 100;
      
      if (priceDistancePercent < 0.05 || priceDistancePercent > 20) {
        console.log(`📊 ${symbol}: Entry price distance ${priceDistancePercent.toFixed(2)}% not suitable`);
        return false;
      }

      // Format entry price
      const formattedEntryPrice = await SupportLevelProcessor.formatSupportLevel(symbol, entryPrice);

      // Create signal
      const reasoning = `${symbol} LIMIT BUY at $${formattedEntryPrice.toFixed(6)} (${entryOffsetPercent}% above support $${supportPrice.toFixed(6)}, ${priceDistancePercent.toFixed(2)}% below market $${currentPrice.toFixed(6)}) - Enhanced ${config.trading_logic_type} analysis${orderValidation.isSecondOrder ? ' (Second Order - EOD)' : ''}`;

      const dbHelper = ServiceContainer.getDatabaseHelper(this.userId);
      const signal = await dbHelper.createSignal({
        user_id: this.userId,
        symbol: symbol,
        signal_type: 'buy',
        price: formattedEntryPrice,
        confidence: Math.max(supportAnalysis.strength || 0.6, 0.6),
        reasoning: reasoning
      });

      console.log(`✅ Enhanced buy signal created for ${symbol}: ID ${signal.id}`);
      
      await this.logger.logSuccess(`Enhanced buy signal created for ${symbol}`, {
        signalId: signal.id,
        symbol,
        supportPrice,
        entryPrice: formattedEntryPrice,
        currentPrice,
        confidence: Math.max(supportAnalysis.strength || 0.6, 0.6)
      });

      return true;
      
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
}
