
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { PositionLimitsChecker } from './validation/PositionLimitsChecker';
import { PositionCounters } from './validation/PositionCounters';
import { DetailedPositionValidator, DetailedValidationResult } from './validation/DetailedPositionValidator';

export class PositionValidator {
  private userId: string;
  private limitsChecker: PositionLimitsChecker;
  private counters: PositionCounters;
  private detailedValidator: DetailedPositionValidator;

  constructor(userId: string) {
    this.userId = userId;
    this.limitsChecker = new PositionLimitsChecker(userId);
    this.counters = new PositionCounters(userId);
    this.detailedValidator = new DetailedPositionValidator(userId);
  }

  async validatePositionLimits(symbol: string, config: TradingConfigData): Promise<boolean> {
    return this.limitsChecker.validatePositionLimits(symbol, config);
  }

  async getCurrentPositionCount(symbol: string): Promise<number> {
    return this.counters.getCurrentPositionCount(symbol);
  }

  async getActivePairsCount(): Promise<number> {
    return this.counters.getActivePairsCount();
  }

  async validateWithDetailedLogging(symbol: string, config: TradingConfigData): Promise<DetailedValidationResult> {
    return this.detailedValidator.validateWithDetailedLogging(symbol, config);
  }
}
