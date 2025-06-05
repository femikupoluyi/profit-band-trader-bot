
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { VALID_CHART_TIMEFRAMES, ChartTimeframe } from './TypeDefinitions';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigValidator {
  static validateTradingConfig(config: TradingConfigData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validations
    if (!config.tradingPairs || config.tradingPairs.length === 0) {
      errors.push('At least one trading pair must be selected');
    }

    if (!config.maxOrderAmountUsd || config.maxOrderAmountUsd <= 0) {
      errors.push('Maximum order amount must be greater than 0');
    }

    if (!config.takeProfitPercent || config.takeProfitPercent <= 0) {
      errors.push('Take profit percentage must be greater than 0');
    }

    if (!config.maxActivePairs || config.maxActivePairs <= 0) {
      errors.push('Maximum active pairs must be greater than 0');
    }

    if (!config.supportCandleCount || config.supportCandleCount <= 0) {
      errors.push('Support candle count must be greater than 0');
    }

    // Range validations
    if (config.maxPortfolioExposurePercent && (config.maxPortfolioExposurePercent <= 0 || config.maxPortfolioExposurePercent > 100)) {
      errors.push('Portfolio exposure percentage must be between 0 and 100');
    }

    if (config.entryOffsetPercent && (config.entryOffsetPercent < 0 || config.entryOffsetPercent > 10)) {
      errors.push('Entry offset percentage must be between 0 and 10');
    }

    if (config.takeProfitPercent && config.takeProfitPercent > 50) {
      warnings.push('Take profit percentage above 50% may be too aggressive');
    }

    if (config.supportLowerBoundPercent && (config.supportLowerBoundPercent < 0 || config.supportLowerBoundPercent > 20)) {
      errors.push('Support lower bound percentage must be between 0 and 20');
    }

    if (config.supportUpperBoundPercent && (config.supportUpperBoundPercent < 0 || config.supportUpperBoundPercent > 10)) {
      errors.push('Support upper bound percentage must be between 0 and 10');
    }

    if (config.newSupportThresholdPercent && (config.newSupportThresholdPercent < 0 || config.newSupportThresholdPercent > 10)) {
      errors.push('New support threshold percentage must be between 0 and 10');
    }

    // Chart timeframe validation
    if (config.chartTimeframe && !VALID_CHART_TIMEFRAMES.includes(config.chartTimeframe as ChartTimeframe)) {
      errors.push(`Invalid chart timeframe. Must be one of: ${VALID_CHART_TIMEFRAMES.join(', ')}`);
    }

    // Loop interval validation
    if (config.mainLoopIntervalSeconds && config.mainLoopIntervalSeconds < 10) {
      warnings.push('Main loop interval less than 10 seconds may cause high API usage');
    }

    if (config.mainLoopIntervalSeconds && config.mainLoopIntervalSeconds > 300) {
      warnings.push('Main loop interval greater than 5 minutes may miss trading opportunities');
    }

    // Trading pairs validation
    if (config.tradingPairs && config.tradingPairs.length > 20) {
      warnings.push('More than 20 trading pairs may cause performance issues');
    }

    // Active pairs vs trading pairs validation
    if (config.maxActivePairs && config.tradingPairs && config.maxActivePairs > config.tradingPairs.length) {
      warnings.push('Maximum active pairs should not exceed the number of available trading pairs');
    }

    // Premium percentages validation
    if (config.manualClosePremiumPercent && (config.manualClosePremiumPercent < 0 || config.manualClosePremiumPercent > 5)) {
      errors.push('Manual close premium percentage must be between 0 and 5');
    }

    if (config.eodClosePremiumPercent && (config.eodClosePremiumPercent < 0 || config.eodClosePremiumPercent > 5)) {
      errors.push('EOD close premium percentage must be between 0 and 5');
    }

    // Position limits validation
    if (config.maxPositionsPerPair && (config.maxPositionsPerPair <= 0 || config.maxPositionsPerPair > 10)) {
      errors.push('Maximum positions per pair must be between 1 and 10');
    }

    // Daily reset time validation (if provided)
    if (config.dailyResetTime) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(config.dailyResetTime)) {
        errors.push('Daily reset time must be in HH:MM format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateMinimumNotionalPerSymbol(config: TradingConfigData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.minimumNotionalPerSymbol && config.tradingPairs) {
      for (const pair of config.tradingPairs) {
        const minNotional = config.minimumNotionalPerSymbol[pair];
        if (!minNotional || minNotional <= 0) {
          errors.push(`Minimum notional for ${pair} must be greater than 0`);
        }
        if (minNotional && minNotional < 5) {
          warnings.push(`Minimum notional for ${pair} is very low (${minNotional}), may cause order rejections`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateQuantityIncrementPerSymbol(config: TradingConfigData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.quantityIncrementPerSymbol && config.tradingPairs) {
      for (const pair of config.tradingPairs) {
        const increment = config.quantityIncrementPerSymbol[pair];
        if (!increment || increment <= 0) {
          errors.push(`Quantity increment for ${pair} must be greater than 0`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
