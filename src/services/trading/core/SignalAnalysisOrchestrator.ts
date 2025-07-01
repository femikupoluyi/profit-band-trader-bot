
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { ServiceContainer } from './ServiceContainer';
import { SystemHealthChecker } from './SystemHealthChecker';
import { ValidationChain } from './ValidationChain';
import { PositionValidator } from './PositionValidator';

export class SignalAnalysisOrchestrator {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private healthChecker: SystemHealthChecker;
  private positionValidator: PositionValidator;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = ServiceContainer.getLogger(userId);
    this.healthChecker = new SystemHealthChecker(userId, bybitService);
    this.positionValidator = new PositionValidator(userId);
  }

  async analyzeAndCreateSignals(config: TradingConfigData): Promise<void> {
    try {
      console.log('\n🧠 ===== ENHANCED SIGNAL ANALYSIS & CREATION =====');
      
      // Debug support analysis for BTCUSDT
      if (config.trading_pairs.includes('BTCUSDT')) {
        console.log('\n🔍 ===== DEBUGGING BTCUSDT SUPPORT ANALYSIS =====');
        const { SupportAnalysisDebugger } = await import('./SupportAnalysisDebugger');
        const supportDebugger = new SupportAnalysisDebugger();
        await supportDebugger.debugSupportAnalysis('BTCUSDT', config);
        console.log('\n🔍 ===== END BTCUSDT DEBUG =====');
      }
      
      await this.logger.logSystemInfo('Starting signal analysis and creation', {
        tradingLogic: config.trading_logic_type,
        activePairs: config.trading_pairs.length,
        maxOrderAmount: config.max_order_amount_usd
      });

      // Perform health check
      const healthReport = await this.healthChecker.performHealthCheck(config);
      console.log(`🏥 System health: ${healthReport.overall}`);

      if (healthReport.overall === 'critical') {
        console.warn('⚠️ System health is critical but continuing with limited functionality');
        await this.logger.logSystemInfo('Signal analysis continuing despite critical system health', {
          healthReport: healthReport.overall
        });
      }

      // Validate configuration
      const configValidation = ValidationChain.validateConfiguration(config);
      if (!configValidation.isValid) {
        console.error('❌ Configuration validation failed:', configValidation.errors);
        await this.logger.logError('Configuration validation failed', new Error(configValidation.errors.join(', ')));
        return;
      }

      if (configValidation.warnings.length > 0) {
        console.warn('⚠️ Configuration warnings:', configValidation.warnings);
      }

      console.log(`📊 Processing ${config.trading_pairs.length} trading pairs for signal analysis`);

      // Process each trading pair
      const { SignalAnalysisProcessor } = await import('./SignalAnalysisProcessor');
      const processor = new SignalAnalysisProcessor(this.userId, this.bybitService);
      
      let signalsCreated = 0;
      for (const symbol of config.trading_pairs) {
        try {
          console.log(`\n📊 Analyzing ${symbol}...`);
          
          // Check position limits
          const positionValidation = await this.positionValidator.validateWithDetailedLogging(symbol, config);
          
          if (!positionValidation.isValid) {
            console.log(`⚠️ Skipping ${symbol}: ${positionValidation.reason}`);
            continue;
          }

          // Analyze and create signal
          const signalCreated = await processor.analyzeSymbolAndCreateSignal(symbol, config);
          
          if (signalCreated) {
            signalsCreated++;
            console.log(`✅ Signal created for ${symbol}`);
          } else {
            console.log(`📊 No signal needed for ${symbol} at this time`);
          }
          
        } catch (error) {
          console.error(`❌ Error analyzing ${symbol}:`, error);
          await this.logger.logError(`Signal analysis failed for ${symbol}`, error);
        }
      }

      console.log(`✅ Signal analysis complete - Created ${signalsCreated} signals`);
      
    } catch (error) {
      console.error('❌ Critical error in signal analysis:', error);
      await this.logger.logError('Critical error in signal analysis', error);
      throw error;
    }
  }
}
