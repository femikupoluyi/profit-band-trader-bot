
export class PriceFormatter {
  private static readonly PRICE_PRECISION_RULES: Record<string, number> = {
    'BTCUSDT': 1,    // BTC prices to 1 decimal place (e.g., 104776.8)
    'ETHUSDT': 2,    // ETH prices to 2 decimal places
    'BNBUSDT': 1,    // BNB prices to 1 decimal place (was 2, causing too many decimals error)
    'SOLUSDT': 3,    // SOL prices to 3 decimal places
    'ADAUSDT': 4,    // ADA prices to 4 decimal places
    'XRPUSDT': 4,    // XRP prices to 4 decimal places
    'LTCUSDT': 2,    // LTC prices to 2 decimal places
    'DOGEUSDT': 5,   // DOGE prices to 5 decimal places
    'MATICUSDT': 4,  // MATIC prices to 4 decimal places
    'FETUSDT': 4,    // FET prices to 4 decimal places
    'POLUSDT': 4,    // POL prices to 4 decimal places
    'XLMUSDT': 5,    // XLM prices to 5 decimal places
  };

  private static readonly QUANTITY_PRECISION_RULES: Record<string, number> = {
    'BTCUSDT': 5,    // BTC allows up to 5 decimals
    'ETHUSDT': 3,    // ETH allows up to 3 decimals  
    'BNBUSDT': 1,    // BNB reduced to 1 decimal for safety (was 2)
    'SOLUSDT': 1,    // SOL reduced to 1 decimal for safety
    'ADAUSDT': 0,    // ADA whole numbers only
    'XRPUSDT': 1,    // XRP 1 decimal place
    'LTCUSDT': 2,    // LTC allows up to 2 decimals
    'DOGEUSDT': 0,   // DOGE whole numbers only
    'MATICUSDT': 0,  // MATIC whole numbers only
    'FETUSDT': 0,    // FET whole numbers only
    'POLUSDT': 0,    // POL whole numbers only
    'XLMUSDT': 0,    // XLM whole numbers only
  };

  static formatPriceForSymbol(symbol: string, price: number): string {
    const decimals = this.PRICE_PRECISION_RULES[symbol] || 2; // Default to 2 decimals
    const formattedPrice = price.toFixed(decimals);
    
    console.log(`Formatting price for ${symbol}: ${price} -> ${formattedPrice} (${decimals} decimals)`);
    return formattedPrice;
  }

  static formatQuantityForSymbol(symbol: string, quantity: number): string {
    const decimals = this.QUANTITY_PRECISION_RULES[symbol] || 0; // Default to 0 decimals for safety
    let formattedQty = quantity.toFixed(decimals);
    
    // Remove trailing zeros but ensure proper formatting
    if (decimals > 0) {
      formattedQty = parseFloat(formattedQty).toString();
    }
    
    console.log(`Formatting quantity for ${symbol}: ${quantity} -> ${formattedQty} (${decimals} decimals)`);
    return formattedQty;
  }
}
