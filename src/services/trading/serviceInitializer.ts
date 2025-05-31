
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../bybitService';
import { MarketScanner } from './marketScanner';
import { SignalAnalyzer } from './signalAnalyzer';
import { TradeExecutor } from './tradeExecutor';
import { PositionMonitor } from './positionMonitor';

export interface TradingServices {
  marketScanner: MarketScanner;
  signalAnalyzer: SignalAnalyzer;
  tradeExecutor: TradeExecutor;
  positionMonitor: PositionMonitor;
}

export class ServiceInitializer {
  private userId: string;
  private config: TradingConfigData;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
  }

  initializeServices(bybitService: BybitService): TradingServices {
    console.log('Initializing trading services with config values:', {
      takeProfitPercent: this.config.take_profit_percent,
      supportCandleCount: this.config.support_candle_count,
      maxActivePairs: this.config.max_active_pairs,
      maxOrderAmount: this.config.max_order_amount_usd
    });
    
    const marketScanner = new MarketScanner(this.userId, bybitService, this.config);
    const signalAnalyzer = new SignalAnalyzer(this.userId, this.config);
    const tradeExecutor = new TradeExecutor(this.userId, this.config, bybitService);
    const positionMonitor = new PositionMonitor(this.userId, bybitService, this.config);

    return {
      marketScanner,
      signalAnalyzer,
      tradeExecutor,
      positionMonitor
    };
  }
}
