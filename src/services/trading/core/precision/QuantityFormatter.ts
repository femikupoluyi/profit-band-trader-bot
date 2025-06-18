
import { BybitInstrumentService } from '../BybitInstrumentService';

export class QuantityFormatter {
  static async formatQuantity(symbol: string, quantity: number): Promise<string> {
    try {
      console.log(`🔧 Formatting quantity for ${symbol}: ${quantity}`);
      
      if (!symbol || typeof quantity !== 'number' || isNaN(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity parameters: symbol=${symbol}, quantity=${quantity}`);
      }

      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (!instrumentInfo) {
        throw new Error(`Could not get instrument info for ${symbol}`);
      }

      const basePrecision = parseFloat(instrumentInfo.basePrecision);
      
      if (isNaN(basePrecision) || basePrecision <= 0) {
        throw new Error(`Invalid base precision for ${symbol}: ${instrumentInfo.basePrecision}`);
      }

      const roundedQuantity = Math.floor(quantity / basePrecision) * basePrecision;
      const decimals = this.calculateDecimalsFromBasePrecision(instrumentInfo.basePrecision);
      const formatted = roundedQuantity.toFixed(decimals);
      
      console.log(`✅ Quantity formatted for ${symbol}: ${quantity} → "${formatted}" (base: ${basePrecision}, decimals: ${decimals})`);
      
      return formatted;
    } catch (error) {
      console.error(`❌ Error formatting quantity for ${symbol}:`, error);
      throw error;
    }
  }

  static async calculateQuantity(symbol: string, orderAmount: number, price: number): Promise<number> {
    try {
      console.log(`🧮 Calculating quantity for ${symbol}: $${orderAmount} at $${price}`);
      
      const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
      if (!instrumentInfo) {
        throw new Error(`Could not get instrument info for ${symbol}`);
      }

      const basePrecision = parseFloat(instrumentInfo.basePrecision);
      const rawQuantity = orderAmount / price;
      const adjustedQuantity = Math.floor(rawQuantity / basePrecision) * basePrecision;
      
      console.log(`✅ Quantity calculated for ${symbol}: ${rawQuantity} → ${adjustedQuantity} (precision: ${basePrecision})`);
      return adjustedQuantity;
    } catch (error) {
      console.error(`❌ Error calculating quantity for ${symbol}:`, error);
      throw error;
    }
  }

  private static calculateDecimalsFromBasePrecision(basePrecision: string): number {
    try {
      console.log(`🔍 Calculating decimals from basePrecision: "${basePrecision}"`);
      
      const num = parseFloat(basePrecision);
      if (isNaN(num)) {
        console.warn(`Invalid basePrecision: ${basePrecision}, using default 4`);
        return 4;
      }

      if (num >= 1) {
        console.log(`Whole number basePrecision ${basePrecision}, using 0 decimals`);
        return 0;
      }

      const fixedStr = num.toFixed(20);
      const dotIndex = fixedStr.indexOf('.');
      
      if (dotIndex === -1) {
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
      console.log(`✅ Calculated ${decimals} decimals from basePrecision "${basePrecision}"`);
      return decimals;
    } catch (error) {
      console.warn(`Error calculating decimals for basePrecision ${basePrecision}:`, error);
      return 4;
    }
  }
}
