
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { MarketDataScannerService } from './MarketDataScannerService';
import { TradeValidator } from './TradeValidator';
import { TrendAnalysisService } from './TrendAnalysisService';
import { SupportResistanceService } from './SupportResistanceService';
import { BybitInstrumentService } from './BybitInstrumentService';
import { supabase } from '@/integrations/supabase/client';

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
  private marketDataScanner: MarketDataScannerService;
  private trendAnalysis: TrendAnalysisService;
  private supportResistance: SupportResistanceService;
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.marketDataScanner = new MarketDataScannerService(userId, bybitService);
    this.trendAnalysis = new TrendAnalysisService(bybitService);
    this.supportResistance = new SupportResistanceService(bybitService);
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

      // Check existing positions
      const { data: activeTrades } = await supabase
        .from('trades')
        .select('id, status, side, price, quantity, created_at')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('side', 'buy')
        .in('status', ['pending', 'filled', 'partial_filled']);

      const { data: existingSignals } = await supabase
        .from('trading_signals')
        .select('id')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('processed', false);

      const totalActiveCount = (existingSignals?.length || 0) + (activeTrades?.length || 0);
      
      if (totalActiveCount >= config.max_positions_per_pair) {
        console.log(`❌ ${symbol}: Max positions reached (${totalActiveCount}/${config.max_positions_per_pair})`);
        return null;
      }

      // Get current market price
      const marketPrice = await this.bybitService.getMarketPrice(symbol);
      if (!marketPrice || !marketPrice.price || marketPrice.price <= 0) {
        console.error(`❌ Invalid market price for ${symbol}`);
        return null;
      }

      const currentPrice = marketPrice.price;
      const isAveragingDown = activeTrades && activeTrades.length > 0;

      console.log(`📊 ${symbol}: Current price: $${currentPrice.toFixed(6)} - ${isAveragingDown ? 'AVERAGING DOWN' : 'NEW POSITION'} scenario`);

      let entryPrice: number;
      let reasoning: string;
      let confidence: number;

      if (isAveragingDown) {
        // Averaging down logic
        const lastBoughtPrice = Math.max(...activeTrades.map(t => parseFloat(t.price.toString())));
        const priceChangePercent = ((currentPrice - lastBoughtPrice) / lastBoughtPrice) * 100;
        
        const lowerBound = -config.support_lower_bound_percent;
        const upperBound = config.support_upper_bound_percent;
        
        console.log(`📐 ${symbol}: Averaging analysis - Price change: ${priceChangePercent.toFixed(2)}%, bounds: ${lowerBound.toFixed(2)}% to +${upperBound.toFixed(2)}%`);

        if (priceChangePercent < lowerBound || priceChangePercent > upperBound) {
          console.log(`❌ ${symbol}: Price not in averaging range`);
          return null;
        }

        // Place limit order below current price for averaging down
        entryPrice = currentPrice * (1 - config.entry_offset_percent / 100);
        confidence = 0.7; // Lower confidence for averaging down
        reasoning = `AVERAGING DOWN: Entry at $${entryPrice.toFixed(6)} (${config.entry_offset_percent}% below current price $${currentPrice.toFixed(6)}). Last bought: $${lastBoughtPrice.toFixed(6)}`;

      } else {
        // New position logic - ensure sufficient data
        const hasData = await Promise.race([
          this.marketDataScanner.ensureSufficientData(symbol, config.support_candle_count || 128),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Market data timeout')), 15000)
          )
        ]);

        if (!hasData) {
          console.warn(`⚠️ Could not ensure sufficient market data for ${symbol}`);
          return null;
        }

        // Get support/resistance levels
        const supportData = await this.supportResistance.getSupportResistanceLevels(
          symbol,
          config.chart_timeframe,
          config.support_candle_count || 128,
          config.support_lower_bound_percent || 5.0,
          config.support_upper_bound_percent || 2.0
        );

        if (!supportData.currentSupport || supportData.currentSupport.price <= 0) {
          console.warn(`⚠️ No valid support level found for ${symbol}`);
          return null;
        }

        const supportPrice = supportData.currentSupport.price;
        
        // Place limit order above support for new positions
        entryPrice = supportPrice * (1 + config.entry_offset_percent / 100);
        confidence = Math.min(0.95, supportData.currentSupport.strength || 0.8);
        reasoning = `NEW POSITION: Entry at $${entryPrice.toFixed(6)} (${config.entry_offset_percent}% above support $${supportPrice.toFixed(6)})`;
      }

      // Get instrument info for proper formatting
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (instrumentInfo) {
        entryPrice = parseFloat(BybitInstrumentService.formatPrice(symbol, entryPrice, instrumentInfo));
      }

      // Calculate quantity
      const quantity = await TradeValidator.calculateQuantity(
        symbol,
        config.max_order_amount_usd || 100,
        entryPrice,
        config
      );

      // Validate trade parameters
      const isValid = await TradeValidator.validateTradeParameters(symbol, quantity, entryPrice, config);
      if (!isValid) {
        console.error(`❌ Trade validation failed for ${symbol}`);
        return null;
      }

      const orderValue = quantity * entryPrice;

      console.log(`✅ Generated ${isAveragingDown ? 'AVERAGING DOWN' : 'NEW POSITION'} signal for ${symbol}:`, {
        entryPrice: entryPrice.toFixed(instrumentInfo?.priceDecimals || 6),
        quantity: quantity.toFixed(instrumentInfo?.quantityDecimals || 6),
        orderValue: orderValue.toFixed(2),
        confidence
      });

      return {
        symbol,
        action: 'buy',
        confidence,
        entryPrice,
        quantity,
        reasoning,
        orderValue,
        isAveragingDown
      };

    } catch (error) {
      console.error(`❌ Error in enhanced signal analysis for ${symbol}:`, error);
      return null;
    }
  }

  private async storeSignal(signal: SignalAnalysisResult, config: TradingConfigData): Promise<void> {
    try {
      const { error } = await supabase
        .from('trading_signals')
        .insert({
          user_id: this.userId,
          symbol: signal.symbol,
          signal_type: signal.action,
          price: signal.entryPrice,
          confidence: signal.confidence,
          reasoning: signal.reasoning,
          processed: false
        });

      if (error) {
        console.error('Error storing signal:', error);
        throw error;
      }

      console.log(`✅ Signal stored for ${signal.symbol}: ${signal.action} at $${signal.entryPrice.toFixed(6)} ${signal.isAveragingDown ? '(AVERAGING DOWN)' : '(NEW POSITION)'}`);
    } catch (error) {
      console.error('Error storing signal in database:', error);
      throw error;
    }
  }
}
