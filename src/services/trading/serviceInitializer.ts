
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
    console.log('Initializing trading services...');
    
    const marketScanner = new MarketScanner(this.userId, bybitService, this.config);
    const signalAnalyzer = new SignalAnalyzer(this.userId, this.config);
    const tradeExecutor = new TradeExecutor(this.userId, this.config, bybitService);
    const positionMonitor = new PositionMonitor(this.userId, bybitService);

    return {
      marketScanner,
      signalAnalyzer,
      tradeExecutor,
      positionMonitor
    };
  }
}
