
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradeValidator } from './TradeValidator';
import { TypeConverter } from './TypeConverter';

/**
 * Centralized validation chain for all trading operations
 */
export class ValidationChain {
  /**
   * Complete validation chain for trade parameters
   */
  static async validateTrade(
    symbol: string,
    quantity: number,
    entryPrice: number,
    config: TradingConfigData
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Step 1: Type validation
      try {
        TypeConverter.toPrice(entryPrice, 'entryPrice');
        TypeConverter.toQuantity(quantity, 'quantity');
      } catch (error) {
        errors.push(`Type validation failed: ${error.message}`);
        return { isValid: false, errors };
      }

      // Step 2: Trade parameter validation
      const isValidTrade = await TradeValidator.validateTradeParameters(symbol, quantity, entryPrice, config);
      if (!isValidTrade) {
        errors.push('Trade parameters validation failed');
      }

      // Step 3: Precision validation
      const isValidPrecision = await TradeValidator.validateQuantityPrecision(symbol, quantity);
      if (!isValidPrecision) {
        errors.push('Quantity precision validation failed');
      }

      // Step 4: Price range validation (if current price is available)
      // This would need current price parameter - skipping for now

      return { isValid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Validation chain error: ${error.message}`);
      return { isValid: false, errors };
    }
  }

  /**
   * Quick validation for basic parameters
   */
  static validateBasicParameters(symbol: string, quantity: number, price: number): { isValid: boolean; error?: string } {
    try {
      if (!symbol || typeof symbol !== 'string') {
        return { isValid: false, error: 'Invalid symbol' };
      }

      TypeConverter.toPrice(price, 'price');
      TypeConverter.toQuantity(quantity, 'quantity');

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Configuration validation
   */
  static validateConfig(config: TradingConfigData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Validate required fields
      if (!config.trading_pairs || config.trading_pairs.length === 0) {
        errors.push('At least one trading pair must be configured');
      }

      // Validate numeric ranges
      try {
        TypeConverter.toPercent(config.take_profit_percent, 'take_profit_percent');
      } catch (error) {
        errors.push(`Invalid take profit percentage: ${error.message}`);
      }

      try {
        TypeConverter.toPercent(config.max_portfolio_exposure_percent, 'max_portfolio_exposure_percent');
      } catch (error) {
        errors.push(`Invalid portfolio exposure percentage: ${error.message}`);
      }

      // Validate order amount
      if (config.max_order_amount_usd > 50000) {
        errors.push('Maximum order amount seems very high (>$50,000)');
      }

      return { isValid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Config validation error: ${error.message}`);
      return { isValid: false, errors };
    }
  }
}
