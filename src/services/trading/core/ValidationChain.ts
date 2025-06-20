
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ValidationChain {
  static validateSignal(signal: any, config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic signal validation
    if (!signal) {
      errors.push('Signal is null or undefined');
      return { isValid: false, errors, warnings };
    }

    if (!signal.symbol || typeof signal.symbol !== 'string') {
      errors.push('Signal must have a valid symbol');
    }

    if (!signal.price || typeof signal.price !== 'number' || signal.price <= 0) {
      errors.push('Signal must have a valid price');
    }

    if (!signal.signal_type || typeof signal.signal_type !== 'string') {
      errors.push('Signal must have a valid signal type');
    }

    // Configuration validation
    if (!config) {
      errors.push('Configuration is required');
      return { isValid: false, errors, warnings };
    }

    if (!config.is_active) {
      warnings.push('Trading configuration is not active');
    }

    if (!config.trading_pairs || !Array.isArray(config.trading_pairs)) {
      errors.push('Trading pairs configuration is invalid');
    } else if (!config.trading_pairs.includes(signal.symbol)) {
      errors.push(`Symbol ${signal.symbol} is not in the configured trading pairs`);
    }

    if (!config.max_order_amount_usd || config.max_order_amount_usd <= 0) {
      errors.push('Maximum order amount must be greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateConfiguration(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push('Configuration is required');
      return { isValid: false, errors, warnings };
    }

    // Required fields validation
    const requiredFields = [
      'max_order_amount_usd',
      'take_profit_percent',
      'entry_offset_percent',
      'trading_pairs'
    ];

    for (const field of requiredFields) {
      if (config[field] === undefined || config[field] === null) {
        errors.push(`Required field '${field}' is missing`);
      }
    }

    // Range validations
    if (config.max_order_amount_usd && config.max_order_amount_usd <= 0) {
      errors.push('Max order amount must be greater than 0');
    }

    if (config.take_profit_percent && (config.take_profit_percent <= 0 || config.take_profit_percent > 50)) {
      warnings.push('Take profit percent should be between 0 and 50');
    }

    if (!config.is_active) {
      warnings.push('Configuration is not active');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateTrade(symbol: string, quantity: number, price: number, config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!symbol || typeof symbol !== 'string') {
      errors.push('Invalid symbol');
    }

    if (!quantity || quantity <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    if (!price || price <= 0) {
      errors.push('Price must be greater than 0');
    }

    // Configuration validation
    if (!config) {
      errors.push('Configuration is required');
      return { isValid: false, errors, warnings };
    }

    if (!config.trading_pairs || !config.trading_pairs.includes(symbol)) {
      errors.push(`Symbol ${symbol} is not in configured trading pairs`);
    }

    const orderValue = quantity * price;
    if (config.max_order_amount_usd && orderValue > config.max_order_amount_usd) {
      errors.push(`Order value ${orderValue} exceeds maximum order amount ${config.max_order_amount_usd}`);
    }

    if (orderValue < 10) {
      warnings.push('Order value is very small and may be rejected by exchange');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
