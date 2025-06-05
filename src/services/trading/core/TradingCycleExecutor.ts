
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { PositionMonitorService } from './PositionMonitorService';
import { MarketDataScannerService } from './MarketDataScannerService';
import { SignalAnalysisService } from './SignalAnalysisService';
import { SignalExecutionService } from './SignalExecutionService';
import { EndOfDayManagerService } from './EndOfDayManagerService';
import { TradingLogger } from './TradingLogger';

export class TradingCycleExecutor {
  private logger: TradingLogger;
  
  constructor(
    private userId: string,
    private positionMonitor: PositionMonitorService,
    private marketScanner: MarketDataScannerService,
    private signalAnalysisService: SignalAnalysisService,
    private signalExecutor: SignalExecutionService,
    private eodManager: EndOfDayManagerService
  ) {
    this.logger = new TradingLogger(userId);
  }

  async executeTradingCycle(configData: TradingConfigData): Promise<void> {
    console.log('\n🔄 === MAIN TRADING LOOP CYCLE START ===');
    
    try {
      console.log(`📊 Cycle config: ${configData.trading_pairs.length} pairs, ${configData.main_loop_interval_seconds}s interval`);

      // Step 1: Position Monitoring & Order Fills
      console.log('\n📊 Step 1: Position Monitoring & Order Fills');
      await this.positionMonitor.checkOrderFills(configData);

      // Step 2: Market Data Scanning  
      console.log('\n📈 Step 2: Market Data Scanning');
      await this.marketScanner.scanMarkets(configData);

      // Step 3: Signal Analysis
      console.log('\n🔍 Step 3: Signal Analysis');
      await this.signalAnalysisService.analyzeAndCreateSignals(configData);

      // Step 4: Signal Execution
      console.log('\n⚡ Step 4: Signal Execution');
      await this.signalExecutor.executeSignal(configData);

      // Step 5: End-of-Day Management
      console.log('\n🌅 Step 5: End-of-Day Management');
      await this.eodManager.manageEndOfDay(configData);

      console.log('✅ === MAIN TRADING LOOP CYCLE COMPLETE ===\n');
      
    } catch (error) {
      console.error('❌ Error in main trading loop cycle:', error);
      throw error;
    }
  }
}
