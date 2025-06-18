
/**
 * Centralized type conversion utilities for database numeric types
 */
export class TypeConverter {
  /**
   * Convert database numeric to TypeScript number with validation
   */
  static toNumber(value: any, fieldName: string = 'value', defaultValue?: number): number {
    if (value === null || value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`${fieldName} cannot be null or undefined`);
    }

    let numValue: number;
    
    if (typeof value === 'string') {
      numValue = parseFloat(value);
    } else if (typeof value === 'number') {
      numValue = value;
    } else {
      throw new Error(`${fieldName} must be a number or numeric string, got ${typeof value}`);
    }

    if (isNaN(numValue) || !isFinite(numValue)) {
      throw new Error(`${fieldName} is not a valid number: ${value}`);
    }

    return numValue;
  }

  /**
   * Convert database numeric to TypeScript number with safe fallback
   */
  static toNumberSafe(value: any, defaultValue: number = 0): number {
    try {
      return this.toNumber(value, 'value', defaultValue);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Validate and convert price values with proper precision
   */
  static toPrice(value: any, fieldName: string = 'price'): number {
    const price = this.toNumber(value, fieldName);
    
    if (price <= 0) {
      throw new Error(`${fieldName} must be positive, got ${price}`);
    }

    // Round to 8 decimal places for crypto precision
    return Math.round(price * 100000000) / 100000000;
  }

  /**
   * Validate and convert quantity values
   */
  static toQuantity(value: any, fieldName: string = 'quantity'): number {
    const quantity = this.toNumber(value, fieldName);
    
    if (quantity <= 0) {
      throw new Error(`${fieldName} must be positive, got ${quantity}`);
    }

    // Round to 8 decimal places for crypto precision
    return Math.round(quantity * 100000000) / 100000000;
  }

  /**
   * Validate and convert percentage values
   */
  static toPercent(value: any, fieldName: string = 'percentage'): number {
    const percent = this.toNumber(value, fieldName);
    
    if (percent < 0 || percent > 100) {
      throw new Error(`${fieldName} must be between 0 and 100, got ${percent}`);
    }

    return percent;
  }

  /**
   * Convert JSONB object with type validation
   */
  static toJSONBObject<T = Record<string, any>>(value: any, fieldName: string = 'jsonb_field'): T {
    if (value === null || value === undefined) {
      return {} as T;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as T;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as T;
        }
      } catch {
        throw new Error(`${fieldName} is not valid JSON`);
      }
    }

    throw new Error(`${fieldName} must be an object or valid JSON string`);
  }

  /**
   * Validate database record has required fields
   */
  static validateRequired<T>(record: any, requiredFields: (keyof T)[], recordType: string = 'record'): void {
    for (const field of requiredFields) {
      if (record[field] === null || record[field] === undefined) {
        throw new Error(`${recordType} missing required field: ${String(field)}`);
      }
    }
  }

  /**
   * Convert database trade record to typed object
   */
  static toTradeRecord(dbRecord: any): {
    id: string;
    user_id: string;
    symbol: string;
    side: string;
    price: number;
    quantity: number;
    status: string;
    order_type: string;
    buy_fill_price?: number;
    profit_loss?: number;
    bybit_order_id?: string;
    created_at: string;
    updated_at: string;
  } {
    this.validateRequired(dbRecord, ['id', 'user_id', 'symbol', 'side', 'price', 'quantity', 'status', 'order_type'], 'Trade');

    return {
      id: String(dbRecord.id),
      user_id: String(dbRecord.user_id),
      symbol: String(dbRecord.symbol),
      side: String(dbRecord.side),
      price: this.toPrice(dbRecord.price),
      quantity: this.toQuantity(dbRecord.quantity),
      status: String(dbRecord.status),
      order_type: String(dbRecord.order_type),
      buy_fill_price: dbRecord.buy_fill_price ? this.toPrice(dbRecord.buy_fill_price, 'buy_fill_price') : undefined,
      profit_loss: dbRecord.profit_loss ? this.toNumber(dbRecord.profit_loss, 'profit_loss') : undefined,
      bybit_order_id: dbRecord.bybit_order_id ? String(dbRecord.bybit_order_id) : undefined,
      created_at: String(dbRecord.created_at),
      updated_at: String(dbRecord.updated_at)
    };
  }

  /**
   * Convert database signal record to typed object
   */
  static toSignalRecord(dbRecord: any): {
    id: string;
    user_id: string;
    symbol: string;
    signal_type: string;
    price: number;
    confidence?: number;
    reasoning?: string;
    processed: boolean;
    created_at: string;
    updated_at: string;
  } {
    this.validateRequired(dbRecord, ['id', 'user_id', 'symbol', 'signal_type', 'price'], 'Signal');

    return {
      id: String(dbRecord.id),
      user_id: String(dbRecord.user_id),
      symbol: String(dbRecord.symbol),
      signal_type: String(dbRecord.signal_type),
      price: this.toPrice(dbRecord.price),
      confidence: dbRecord.confidence ? this.toNumber(dbRecord.confidence, 'confidence') : undefined,
      reasoning: dbRecord.reasoning ? String(dbRecord.reasoning) : undefined,
      processed: Boolean(dbRecord.processed),
      created_at: String(dbRecord.created_at),
      updated_at: String(dbRecord.updated_at)
    };
  }
}
