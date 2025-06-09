
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { ErrorHandler, TradingError } from './ErrorHandler';

export class ValidationService {
  /**
   * Validate trading configuration data
   */
  static validateTradingConfig(config: TradingConfigData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Validate required numeric fields
      if (config.max_order_amount_usd <= 0) {
        errors.push('Max order amount must be positive');
      }

      if (config.max_order_amount_usd > 100000) {
        errors.push('Max order amount exceeds reasonable limit (100,000 USD)');
      }

      if (config.take_profit_percent <= 0 || config.take_profit_percent > 100) {
        errors.push('Take profit percent must be between 0 and 100');
      }

      if (config.max_active_pairs <= 0 || config.max_active_pairs > 50) {
        errors.push('Max active pairs must be between 1 and 50');
      }

      if (config.entry_offset_percent < 0 || config.entry_offset_percent > 10) {
        errors.push('Entry offset percent must be between 0 and 10');
      }

      // Validate trading pairs
      if (!config.trading_pairs || config.trading_pairs.length === 0) {
        errors.push('At least one trading pair must be configured');
      } else {
        const validPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LTCUSDT', 'POLUSDT', 'FETUSDT', 'XRPUSDT', 'XLMUSDT'];
        const invalidPairs = config.trading_pairs.filter(pair => !validPairs.includes(pair));
        if (invalidPairs.length > 0) {
          errors.push(`Invalid trading pairs: ${invalidPairs.join(', ')}`);
        }
      }

      // Validate percentage fields
      if (config.max_portfolio_exposure_percent > 100) {
        errors.push('Portfolio exposure cannot exceed 100%');
      }

      // Validate time-based fields
      if (config.main_loop_interval_seconds < 10 || config.main_loop_interval_seconds > 3600) {
        errors.push('Main loop interval must be between 10 and 3600 seconds');
      }

    } catch (error) {
      errors.push(`Configuration validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate signal data
   */
  static validateSignal(signal: any): { isValid: boolean; error?: string } {
    try {
      if (!signal) {
        return { isValid: false, error: 'Signal is null or undefined' };
      }

      if (!signal.symbol || typeof signal.symbol !== 'string') {
        return { isValid: false, error: 'Signal must have a valid symbol' };
      }

      if (!signal.signal_type || typeof signal.signal_type !== 'string') {
        return { isValid: false, error: 'Signal must have a valid signal_type' };
      }

      if (!signal.price || typeof signal.price !== 'number' || signal.price <= 0) {
        return { isValid: false, error: 'Signal must have a valid positive price' };
      }

      if (signal.confidence !== undefined && (typeof signal.confidence !== 'number' || signal.confidence < 0 || signal.confidence > 1)) {
        return { isValid: false, error: 'Signal confidence must be a number between 0 and 1' };
      }

      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: `Signal validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Validate order parameters
   */
  static validateOrderParameters(
    symbol: string,
    quantity: number,
    price: number,
    orderType: string = 'limit'
  ): { isValid: boolean; error?: string } {
    try {
      if (!symbol || typeof symbol !== 'string') {
        return { isValid: false, error: 'Symbol must be a valid string' };
      }

      if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
        return { isValid: false, error: 'Quantity must be a positive number' };
      }

      if (!price || typeof price !== 'number' || price <= 0) {
        return { isValid: false, error: 'Price must be a positive number' };
      }

      const validOrderTypes = ['limit', 'market'];
      if (!validOrderTypes.includes(orderType.toLowerCase())) {
        return { isValid: false, error: `Order type must be one of: ${validOrderTypes.join(', ')}` };
      }

      // Additional business logic validations
      const orderValue = quantity * price;
      if (orderValue < 1) {
        return { isValid: false, error: 'Order value must be at least $1' };
      }

      if (orderValue > 1000000) {
        return { isValid: false, error: 'Order value exceeds maximum limit ($1,000,000)' };
      }

      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: `Order parameter validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Validate user ID
   */
  static validateUserId(userId: any): { isValid: boolean; error?: string } {
    if (!userId) {
      return { isValid: false, error: 'User ID is required' };
    }

    if (typeof userId !== 'string') {
      return { isValid: false, error: 'User ID must be a string' };
    }

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return { isValid: false, error: 'User ID must be a valid UUID' };
    }

    return { isValid: true };
  }

  /**
   * Sanitize and validate string input
   */
  static sanitizeString(input: any, maxLength: number = 255): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .substring(0, maxLength)
      .replace(/[<>]/g, ''); // Basic XSS prevention
  }

  /**
   * Validate numeric range
   */
  static validateNumericRange(
    value: number,
    min: number,
    max: number,
    fieldName: string
  ): { isValid: boolean; error?: string } {
    if (typeof value !== 'number' || isNaN(value)) {
      return { isValid: false, error: `${fieldName} must be a valid number` };
    }

    if (value < min) {
      return { isValid: false, error: `${fieldName} must be at least ${min}` };
    }

    if (value > max) {
      return { isValid: false, error: `${fieldName} cannot exceed ${max}` };
    }

    return { isValid: true };
  }
}
