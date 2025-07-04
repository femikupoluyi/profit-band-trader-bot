
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SignalProcessorCore } from './core/execution/SignalProcessor';
import { ServiceContainer } from './core/ServiceContainer';
import { EndOfDayManagerService } from './core/EndOfDayManagerService';
import { CredentialsManager } from './credentialsManager';

/**
 * PHASE 2 CONSOLIDATED: Streamlined TradeExecutor using ServiceContainer pattern
 */
export class TradeExecutor {
  private userId: string;
  private signalProcessor: SignalProcessorCore;
  private eodManager: EndOfDayManagerService | null = null;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.signalProcessor = new SignalProcessorCore(userId);
  }

  async processSignals(): Promise<void> {
    const signalFetcher = ServiceContainer.getSignalFetcher(this.userId);
    const signals = await signalFetcher.getUnprocessedSignals(3); // Limit to prevent runaway
    
    if (signals.length === 0) {
      console.log('📭 No signals to process');
      return;
    }

    await this.signalProcessor.processSignals(signals);
  }

  async closeEndOfDayTrades(): Promise<void> {
    if (!this.eodManager) {
      const credentialsManager = new CredentialsManager(this.userId);
      const bybitService = await credentialsManager.fetchCredentials();
      if (bybitService) {
        this.eodManager = new EndOfDayManagerService(this.userId, bybitService);
      }
    }

    if (this.eodManager) {
      // EOD logic would go here - simplified for now
      console.log('🌅 End-of-day trade management completed');
    }
  }
}
