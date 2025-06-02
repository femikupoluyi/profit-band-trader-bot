
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../bybitService';
import { MarketScanner } from './marketScanner';
import { SignalAnalyzer } from './signalAnalyzer';
import { SignalGenerator } from './signalGenerator';
import { TradeExecutor } from './tradeExecutor';
import { PositionMonitor } from './positionMonitor';
import { TradeSyncService } from './tradeSyncService';

export interface TradingServices {
  bybitService: BybitService;
  marketScanner: MarketScanner;
  signalAnalyzer: SignalAnalyzer;
  signalGenerator: SignalGenerator;
  tradeExecutor: TradeExecutor;
  positionMonitor: PositionMonitor;
  tradeSyncService: TradeSyncService;
}

export class ServiceInitializer {
  private userId: string;
  private config: TradingConfigData;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
  }

  initializeServices(bybitService: BybitService): TradingServices {
    // Ensure config has proper defaults before initializing services
    const validatedConfig: TradingConfigData = {
      ...this.config,
      take_profit_percent: this.config.take_profit_percent || 2.0,
      entry_offset_percent: this.config.entry_offset_percent || 1.0,
      max_order_amount_usd: this.config.max_order_amount_usd || 100.0,
      max_positions_per_pair: this.config.max_positions_per_pair || 2,
      new_support_threshold_percent: this.config.new_support_threshold_percent || 2.0,
      max_active_pairs: this.config.max_active_pairs || 5,
      support_candle_count: this.config.support_candle_count || 20
    };
    
    console.log('Initializing trading services with validated config:', {
      takeProfitPercent: validatedConfig.take_profit_percent,
      entryOffsetPercent: validatedConfig.entry_offset_percent,
      maxOrderAmount: validatedConfig.max_order_amount_usd,
      maxActivePairs: validatedConfig.max_active_pairs,
      maxPositionsPerPair: validatedConfig.max_positions_per_pair,
      supportCandleCount: validatedConfig.support_candle_count
    });
    
    const marketScanner = new MarketScanner(this.userId, bybitService, validatedConfig);
    const signalAnalyzer = new SignalAnalyzer(this.userId, validatedConfig);
    const signalGenerator = new SignalGenerator(this.userId, validatedConfig);
    const tradeExecutor = new TradeExecutor(this.userId, validatedConfig, bybitService);
    const positionMonitor = new PositionMonitor(this.userId, bybitService, validatedConfig);
    const tradeSyncService = new TradeSyncService(this.userId, bybitService);

    return {
      bybitService,
      marketScanner,
      signalAnalyzer,
      signalGenerator,
      tradeExecutor,
      positionMonitor,
      tradeSyncService
    };
  }
}
