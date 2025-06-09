
/**
 * Service for validating trading data and preventing data corruption
 */
export class DataValidationService {
  /**
   * Validate trade object before database operations
   */
  static validateTradeForDatabase(trade: any): { isValid: boolean; errors: string[]; sanitizedTrade?: any } {
    const errors: string[] = [];
    
    if (!trade) {
      errors.push('Trade object is null or undefined');
      return { isValid: false, errors };
    }

    // Validate required fields
    if (!trade.user_id || typeof trade.user_id !== 'string') {
      errors.push('Invalid or missing user_id');
    }

    if (!trade.symbol || typeof trade.symbol !== 'string') {
      errors.push('Invalid or missing symbol');
    }

    if (!trade.side || !['buy', 'sell'].includes(trade.side.toLowerCase())) {
      errors.push('Invalid side - must be buy or sell');
    }

    // Validate numeric fields
    const price = this.validateAndSanitizeNumeric(trade.price, 'price');
    if (price.error) {
      errors.push(price.error);
    }

    const quantity = this.validateAndSanitizeNumeric(trade.quantity, 'quantity');
    if (quantity.error) {
      errors.push(quantity.error);
    }

    // Validate optional numeric fields
    const fillPrice = trade.buy_fill_price ? this.validateAndSanitizeNumeric(trade.buy_fill_price, 'buy_fill_price') : { value: null };
    if (fillPrice.error) {
      errors.push(fillPrice.error);
    }

    const profitLoss = trade.profit_loss ? this.validateAndSanitizeNumeric(trade.profit_loss, 'profit_loss') : { value: null };
    if (profitLoss.error) {
      errors.push(profitLoss.error);
    }

    // Validate status
    const validStatuses = ['pending', 'filled', 'partial_filled', 'cancelled', 'closed'];
    if (!trade.status || !validStatuses.includes(trade.status)) {
      errors.push(`Invalid status - must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate order_type
    const validOrderTypes = ['market', 'limit'];
    if (!trade.order_type || !validOrderTypes.includes(trade.order_type)) {
      errors.push(`Invalid order_type - must be one of: ${validOrderTypes.join(', ')}`);
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Return sanitized trade data
    const sanitizedTrade = {
      ...trade,
      side: trade.side.toLowerCase(),
      price: price.value,
      quantity: quantity.value,
      buy_fill_price: fillPrice.value,
      profit_loss: profitLoss.value,
      status: trade.status.toLowerCase(),
      order_type: trade.order_type.toLowerCase()
    };

    return { isValid: true, errors: [], sanitizedTrade };
  }

  /**
   * Validate and sanitize numeric values for database storage
   */
  private static validateAndSanitizeNumeric(value: any, fieldName: string): { value: number | null; error?: string } {
    if (value === null || value === undefined) {
      return { value: null };
    }

    let numValue: number;
    
    if (typeof value === 'string') {
      numValue = parseFloat(value);
    } else if (typeof value === 'number') {
      numValue = value;
    } else {
      return { value: null, error: `${fieldName} must be a number or numeric string` };
    }

    if (isNaN(numValue) || !isFinite(numValue)) {
      return { value: null, error: `${fieldName} is not a valid number: ${value}` };
    }

    if (numValue < 0 && !['profit_loss'].includes(fieldName)) {
      return { value: null, error: `${fieldName} cannot be negative: ${numValue}` };
    }

    // Round to appropriate decimal places to prevent precision issues
    const roundedValue = Math.round(numValue * 100000000) / 100000000; // 8 decimal places

    return { value: roundedValue };
  }

  /**
   * Validate trading configuration
   */
  static validateTradingConfig(config: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config) {
      errors.push('Trading config is null or undefined');
      return { isValid: false, errors };
    }

    if (!config.user_id) {
      errors.push('user_id is required');
    }

    // Validate trading pairs
    if (!Array.isArray(config.trading_pairs) || config.trading_pairs.length === 0) {
      errors.push('trading_pairs must be a non-empty array');
    } else {
      config.trading_pairs.forEach((pair: any, index: number) => {
        if (!pair || typeof pair !== 'string') {
          errors.push(`trading_pairs[${index}] must be a string`);
        }
      });
    }

    // Validate numeric configuration values
    const numericFields = [
      'max_order_amount_usd',
      'take_profit_percent',
      'entry_offset_percent',
      'max_active_pairs',
      'max_positions_per_pair'
    ];

    numericFields.forEach(field => {
      if (config[field] !== undefined && config[field] !== null) {
        const validation = this.validateAndSanitizeNumeric(config[field], field);
        if (validation.error) {
          errors.push(validation.error);
        }
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Sanitize symbol for API calls
   */
  static sanitizeSymbol(symbol: any): string | null {
    if (!symbol || typeof symbol !== 'string') {
      return null;
    }

    // Remove whitespace and convert to uppercase
    const sanitized = symbol.trim().toUpperCase();
    
    // Basic validation for crypto trading pairs
    if (!/^[A-Z0-9]+USDT?$/.test(sanitized)) {
      return null;
    }

    return sanitized;
  }
}
