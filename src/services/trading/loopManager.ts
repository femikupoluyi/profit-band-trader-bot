
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { PositionMonitor } from './positionMonitor';
import { TradeExecutor } from './tradeExecutor';
import { MarketScanner } from './marketScanner';
import { SignalGenerator } from './signalGenerator';
import { SignalAnalyzer } from './signalAnalyzer';
import { TradeSyncService } from './tradeSyncService';
import { BybitService } from '../bybitService';

interface TradingServices {
  bybitService: BybitService;
  positionMonitor: PositionMonitor;
  tradeExecutor: TradeExecutor;
  marketScanner: MarketScanner;
  signalGenerator: SignalGenerator;
  signalAnalyzer: SignalAnalyzer;
  tradeSyncService: TradeSyncService;
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

    console.log('🔄 STARTING TRADING LOOP...');
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

    console.log('⏹️  STOPPING TRADING LOOP...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async runTradingCycle(): Promise<void> {
    if (!this.services || !this.isRunning) return;

    try {
      const cycleStart = Date.now();
      console.log('\n' + '='.repeat(80));
      console.log('🔄 STARTING TRADING CYCLE at', new Date().toISOString());
      console.log('='.repeat(80));

      // 0. ENHANCED SYNC: Ensure all trades are synced with Bybit and detect closed positions
      console.log('\n🔄 STEP 0: COMPREHENSIVE TRADE SYNCHRONIZATION...');
      await this.services.tradeSyncService.syncAllActiveTrades();
      await this.services.tradeSyncService.detectAndRecordClosedPositions();

      // 1. FIRST PRIORITY: Monitor positions and fill pending orders
      console.log('\n📊 STEP 1: MONITORING POSITIONS...');
      await this.services.positionMonitor.monitorPositions();

      // 2. Scan markets for new price data
      console.log('\n🔍 STEP 2: SCANNING MARKETS...');
      await this.services.marketScanner.scanMarkets();

      // 3. Analyze markets and generate signals - using the correct method name
      console.log('\n📈 STEP 3: ANALYZING SIGNALS...');
      await this.services.signalAnalyzer.analyzeAndCreateSignals(this.config);

      // 4. Execute trades based on signals
      console.log('\n⚡ STEP 4: PROCESSING SIGNALS...');
      await this.services.tradeExecutor.processSignals();

      // 5. Close end-of-day trades if needed
      console.log('\n🌅 STEP 5: END-OF-DAY CHECKS...');
      await this.services.tradeExecutor.closeEndOfDayTrades();

      const cycleTime = Date.now() - cycleStart;
      console.log('\n' + '='.repeat(80));
      console.log(`✅ TRADING CYCLE COMPLETED in ${cycleTime}ms`);
      console.log('='.repeat(80) + '\n');

    } catch (error) {
      console.error('❌ ERROR IN TRADING CYCLE:', error);
    }
  }
}
