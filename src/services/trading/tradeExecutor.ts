
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../bybitService';
import { SignalProcessorService } from './signalProcessorService';
import { SignalExecutionService } from './core/SignalExecutionService';
import { EndOfDayService } from './endOfDayService';

export class TradeExecutor {
  private userId: string;
  private config: TradingConfigData;
  private signalProcessorService: SignalProcessorService;
  private endOfDayService: EndOfDayService;

  constructor(userId: string, config: TradingConfigData, bybitService: BybitService) {
    this.userId = userId;
    this.config = config;
    
    const signalExecutionService = new SignalExecutionService(userId, bybitService);
    this.signalProcessorService = new SignalProcessorService(userId, signalExecutionService, config);
    this.endOfDayService = new EndOfDayService(userId, config, bybitService);
  }

  async processSignals(): Promise<void> {
    return this.signalProcessorService.processSignals();
  }

  async closeEndOfDayTrades(): Promise<void> {
    return this.endOfDayService.closeEndOfDayTrades();
  }
}
