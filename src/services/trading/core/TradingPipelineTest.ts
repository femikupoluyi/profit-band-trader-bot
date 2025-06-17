
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { EnhancedSignalAnalysisService } from './EnhancedSignalAnalysisService';
import { SignalExecutionService } from './SignalExecutionService';
import { TradingLogger } from './TradingLogger';

export class TradingPipelineTest {
  private userId: string;
  private bybitService: BybitService;
  private signalAnalysisService: EnhancedSignalAnalysisService;
  private signalExecutionService: SignalExecutionService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.signalAnalysisService = new EnhancedSignalAnalysisService(userId, bybitService);
    this.signalExecutionService = new SignalExecutionService(userId, bybitService);
    this.logger = new TradingLogger(userId);
  }

  async testSimpleSignalGeneration(config: TradingConfigData): Promise<boolean> {
    try {
      console.log('\n🧪 ===== PHASE 3: TESTING SIMPLE SIGNAL GENERATION =====');
      
      if (!config.trading_pairs || config.trading_pairs.length === 0) {
        console.log('❌ No trading pairs configured for testing');
        return false;
      }

      const testSymbol = config.trading_pairs[0];
      console.log(`🧪 Testing signal generation for ${testSymbol}`);
      
      // Test simple signal creation
      const success = await this.signalAnalysisService.createTestSignal(testSymbol, config);
      
      if (success) {
        console.log(`✅ Test signal created successfully for ${testSymbol}`);
        
        // Test signal execution
        console.log(`🧪 Testing signal execution pipeline...`);
        const executionSuccess = await this.signalExecutionService.testSignalExecution(config);
        
        if (executionSuccess) {
          console.log('✅ Signal execution pipeline test passed');
        } else {
          console.log('❌ Signal execution pipeline test failed');
        }
        
        return executionSuccess;
      } else {
        console.log(`❌ Test signal creation failed for ${testSymbol}`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error in pipeline testing:', error);
      await this.logger.logError('Pipeline testing failed', error);
      return false;
    }
  }

  async testFullTradingLogic(config: TradingConfigData): Promise<boolean> {
    try {
      console.log('\n🧪 ===== PHASE 4: TESTING FULL TRADING LOGIC =====');
      
      // Test with actual trading logic
      console.log(`🧪 Testing with trading logic: ${config.trading_logic_type}`);
      
      await this.signalAnalysisService.analyzeAndCreateSignals(config);
      console.log('✅ Full signal analysis completed');
      
      await this.signalExecutionService.executeSignal(config);
      console.log('✅ Full signal execution completed');
      
      return true;
      
    } catch (error) {
      console.error('❌ Error in full logic testing:', error);
      await this.logger.logError('Full logic testing failed', error);
      return false;
    }
  }
}
