
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { PositionMonitorService } from './PositionMonitorService';
import { MarketDataScannerService } from './MarketDataScannerService';
import { EnhancedSignalAnalysisService } from './EnhancedSignalAnalysisService';
import { SignalExecutionService } from './SignalExecutionService';
import { EndOfDayManagerService } from './EndOfDayManagerService';
import { TradingLogger } from './TradingLogger';

export class TradingCycleExecutor {
  private logger: TradingLogger;
  
  constructor(
    private userId: string,
    private positionMonitor: PositionMonitorService,
    private marketScanner: MarketDataScannerService,
    private signalAnalysisService: EnhancedSignalAnalysisService,
    private signalExecutor: SignalExecutionService,
    private eodManager: EndOfDayManagerService
  ) {
    this.logger = new TradingLogger(userId);
  }

  async executeTradingCycle(configData: TradingConfigData): Promise<void> {
    console.log('\n🔄 === ENHANCED TRADING LOOP CYCLE START ===');
    
    try {
      console.log(`📊 Cycle config: ${configData.trading_pairs.length} pairs, ${configData.main_loop_interval_seconds}s interval`);
      console.log(`🧠 Trading Logic: ${configData.trading_logic_type}`);
      console.log(`⚙️ Configuration Active: ${configData.is_active ? 'YES' : 'NO'}`);

      if (!configData.is_active) {
        console.log('⚠️ Trading configuration is INACTIVE - skipping cycle');
        return;
      }

      // Step 1: Position Monitoring & Order Fills
      console.log('\n📊 Step 1: Enhanced Position Monitoring & Order Fills');
      await this.positionMonitor.checkOrderFills(configData);

      // Step 2: Market Data Scanning  
      console.log('\n📈 Step 2: Market Data Scanning');
      await this.marketScanner.scanMarkets(configData);

      // Step 3: Enhanced Signal Analysis
      console.log('\n🧠 Step 3: Enhanced Signal Analysis');
      console.log(`🎯 Using Trading Logic: ${configData.trading_logic_type}`);
      if (configData.trading_logic_type === 'logic2_data_driven') {
        console.log('🔥 LOGIC 2 DETERMINISTIC MODE - This WILL generate signals!');
      }
      await this.signalAnalysisService.analyzeAndCreateSignals(configData);

      // Step 4: Signal Execution
      console.log('\n⚡ Step 4: Signal Execution');
      await this.signalExecutor.executeSignal(configData);

      // Step 5: End-of-Day Management
      console.log('\n🌅 Step 5: End-of-Day Management');
      await this.eodManager.manageEndOfDay(configData);

      console.log('✅ === ENHANCED TRADING LOOP CYCLE COMPLETE ===\n');
      
    } catch (error) {
      console.error('❌ Error in enhanced trading loop cycle:', error);
      throw error;
    }
  }
}
