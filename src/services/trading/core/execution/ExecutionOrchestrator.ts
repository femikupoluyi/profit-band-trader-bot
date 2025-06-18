
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from '../TradingLogger';
import { ServiceContainer } from '../ServiceContainer';

export class ExecutionOrchestrator {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = ServiceContainer.getLogger(userId);
  }

  async validateExecution(config: TradingConfigData): Promise<boolean> {
    console.log('🔧 Execution Configuration:', {
      maxOrderAmount: config.max_order_amount_usd,
      takeProfitPercent: config.take_profit_percent,
      entryOffsetPercent: config.entry_offset_percent,
      maxPositionsPerPair: config.max_positions_per_pair,
      configurationActive: config.is_active
    });
    
    await this.logger.logSystemInfo('Starting signal execution', {
      configSnapshot: {
        maxOrderAmount: config.max_order_amount_usd,
        tradingPairs: config.trading_pairs,
        maxPositionsPerPair: config.max_positions_per_pair,
        isActive: config.is_active
      }
    });

    if (!config.is_active) {
      console.log('⚠️ Configuration is INACTIVE - skipping signal execution');
      await this.logger.logSystemInfo('Signal execution skipped - configuration inactive');
      return false;
    }

    return true;
  }

  async logExecutionStart(): Promise<void> {
    console.log('\n⚡ ===== SIGNAL EXECUTION START =====');
  }

  async logExecutionComplete(): Promise<void> {
    console.log('✅ ===== SIGNAL EXECUTION COMPLETE =====\n');
  }
}
