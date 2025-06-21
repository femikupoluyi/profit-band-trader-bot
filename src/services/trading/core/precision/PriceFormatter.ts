
import { BybitInstrumentService } from '../BybitInstrumentService';

export class PriceFormatter {
  static async formatPrice(symbol: string, price: number): Promise<string> {
    try {
      console.log(`🔧 Formatting price for ${symbol}: ${price}`);
      
      if (!symbol || typeof price !== 'number' || isNaN(price) || price <= 0) {
        throw new Error(`Invalid price parameters: symbol=${symbol}, price=${price}`);
      }

      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (!instrumentInfo) {
        // ENHANCED: Fallback to reasonable default instead of failing
        console.warn(`⚠️ No instrument info for ${symbol}, using fallback precision of 4 decimals`);
        const formatted = price.toFixed(4);
        console.log(`✅ Price formatted for ${symbol} (fallback): ${price} → "${formatted}"`);
        return formatted;
      }

      const tickSize = parseFloat(instrumentInfo.tickSize);
      
      if (isNaN(tickSize) || tickSize <= 0) {
        // ENHANCED: Fallback instead of failing
        console.warn(`⚠️ Invalid tick size for ${symbol}: ${instrumentInfo.tickSize}, using fallback`);
        const formatted = price.toFixed(4);
        console.log(`✅ Price formatted for ${symbol} (fallback): ${price} → "${formatted}"`);
        return formatted;
      }

      const roundedPrice = Math.round(price / tickSize) * tickSize;
      const decimals = this.calculateDecimalsFromTickSize(instrumentInfo.tickSize);
      const formatted = roundedPrice.toFixed(decimals);
      
      console.log(`✅ Price formatted for ${symbol}: ${price} → "${formatted}" (tick: ${tickSize}, decimals: ${decimals})`);
      
      return formatted;
    } catch (error) {
      // ENHANCED: Graceful fallback instead of throwing
      console.warn(`⚠️ Error formatting price for ${symbol}, using fallback:`, error);
      const formatted = price.toFixed(4);
      console.log(`✅ Price formatted for ${symbol} (error fallback): ${price} → "${formatted}"`);
      return formatted;
    }
  }

  private static calculateDecimalsFromTickSize(tickSize: string): number {
    try {
      console.log(`🔍 Calculating decimals from tickSize: "${tickSize}"`);
      
      const num = parseFloat(tickSize);
      if (isNaN(num)) {
        console.warn(`Invalid tickSize: ${tickSize}, using default 4`);
        return 4;
      }

      const fixedStr = num.toFixed(20);
      const dotIndex = fixedStr.indexOf('.');
      
      if (dotIndex === -1) {
        console.log(`No decimals in tickSize ${tickSize}`);
        return 0;
      }

      let decimals = 0;
      for (let i = fixedStr.length - 1; i > dotIndex; i--) {
        if (fixedStr[i] !== '0') {
          decimals = i - dotIndex;
          break;
        }
      }
      
      decimals = Math.min(decimals, 8);
      console.log(`✅ Calculated ${decimals} decimals from tickSize "${tickSize}"`);
      return decimals;
    } catch (error) {
      console.warn(`Error calculating decimals for tickSize ${tickSize}:`, error);
      return 4;
    }
  }
}
