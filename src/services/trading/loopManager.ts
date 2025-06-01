
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { PositionMonitor } from './positionMonitor';
import { TradeExecutor } from './tradeExecutor';
import { MarketScanner } from './marketScanner';
import { SignalGenerator } from './signalGenerator';
import { BybitService } from '../bybitService';

interface TradingServices {
  bybitService: BybitService;
  positionMonitor: PositionMonitor;
  tradeExecutor: TradeExecutor;
  marketScanner: MarketScanner;
  signalGenerator: SignalGenerator;
}

export class LoopManager {
  private userId: string;
  private config: TradingConfigData;
  private services: TradingServices | null = null;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
  }

  setServices(services: TradingServices): void {
    this.services = services;
  }

  start(): void {
    if (this.isRunning || !this.services) {
      console.log('Trading loop already running or services not initialized');
      return;
    }

    console.log('Starting trading loop...');
    this.isRunning = true;

    // Run immediately
    this.runTradingCycle();

    // Then run every 30 seconds
    this.intervalId = setInterval(() => {
      this.runTradingCycle();
    }, 30000);
  }

  stop(): void {
    if (!this.isRunning) {
      console.log('Trading loop not running');
      return;
    }

    console.log('Stopping trading loop...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async runTradingCycle(): Promise<void> {
    if (!this.services || !this.isRunning) return;

    try {
      console.log('\n🔄 Starting trading cycle...');

      // 1. FIRST PRIORITY: Monitor positions and fill pending orders
      console.log('📊 Monitoring positions and checking for fills...');
      await this.services.positionMonitor.monitorPositions();

      // 2. Scan markets for new opportunities
      console.log('🔍 Scanning markets...');
      await this.services.marketScanner.scanMarkets();

      // 3. Generate signals based on market data
      console.log('📈 Generating signals...');
      await this.services.signalGenerator.generateSignals();

      // 4. Execute trades based on signals
      console.log('⚡ Processing signals and executing trades...');
      await this.services.tradeExecutor.processSignals();

      // 5. Close end-of-day trades if needed
      console.log('🌅 Checking for end-of-day closures...');
      await this.services.tradeExecutor.closeEndOfDayTrades();

      console.log('✅ Trading cycle completed successfully\n');

    } catch (error) {
      console.error('Error in trading cycle:', error);
    }
  }
}
