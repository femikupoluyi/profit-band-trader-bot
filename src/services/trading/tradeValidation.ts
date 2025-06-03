
export class TradeValidation {
  private static formatQuantityForSymbol(symbol: string, quantity: number): string {
    // Stricter precision rules to avoid "too many decimals" errors
    const precisionRules: Record<string, number> = {
      'BTCUSDT': 5,    // BTC allows up to 5 decimals
      'ETHUSDT': 3,    // ETH allows up to 3 decimals  
      'BNBUSDT': 2,    // BNB allows up to 2 decimals
      'SOLUSDT': 1,    // SOL reduced to 1 decimal for safety
      'ADAUSDT': 0,    // ADA whole numbers only
      'XRPUSDT': 0,    // XRP whole numbers only
      'LTCUSDT': 3,    // LTC allows up to 3 decimals
      'DOGEUSDT': 0,   // DOGE whole numbers only
      'MATICUSDT': 0,  // MATIC whole numbers only
      'FETUSDT': 0,    // FET whole numbers only
      'POLUSDT': 0,    // POL whole numbers only - this was causing errors
      'XLMUSDT': 0,    // XLM whole numbers only
    };

    const decimals = precisionRules[symbol] || 0; // Default to 0 decimals for safety
    let formattedQty = quantity.toFixed(decimals);
    
    // Remove trailing zeros but ensure proper formatting
    if (decimals > 0) {
      formattedQty = parseFloat(formattedQty).toString();
    }
    
    console.log(`Formatting quantity for ${symbol}: ${quantity} -> ${formattedQty} (${decimals} decimals, strict mode)`);
    return formattedQty;
  }

  private static validateMinOrderValue(symbol: string, quantity: number, price: number): boolean {
    const orderValue = quantity * price;
    
    // Conservative minimum order values
    const minOrderValues: Record<string, number> = {
      'BTCUSDT': 25,
      'ETHUSDT': 25,
      'BNBUSDT': 25,
      'SOLUSDT': 25,
      'LTCUSDT': 25,
      'ADAUSDT': 15,
      'XRPUSDT': 15,
      'DOGEUSDT': 15,
      'MATICUSDT': 15,
      'FETUSDT': 15,
      'POLUSDT': 15,
      'XLMUSDT': 15,
    };

    const minValue = minOrderValues[symbol] || 25;
    
    console.log(`Order value validation for ${symbol}: ${orderValue.toFixed(2)} USD (min: ${minValue})`);
    
    if (orderValue < minValue) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} below minimum ${minValue}`);
      return false;
    }
    
    return true;
  }

  static getFormattedQuantity(symbol: string, quantity: number): string {
    return this.formatQuantityForSymbol(symbol, quantity);
  }

  static isValidOrderValue(symbol: string, quantity: number, price: number): boolean {
    return this.validateMinOrderValue(symbol, quantity, price);
  }
}
