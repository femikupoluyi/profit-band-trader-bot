
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitInstrumentService } from './BybitInstrumentService';

export class TradeValidator {
  static async validateTradeParameters(symbol: string, quantity: number, entryPrice: number, config: TradingConfigData): Promise<boolean> {
    // Validate basic parameters
    if (isNaN(entryPrice) || isNaN(quantity) || quantity <= 0 || entryPrice <= 0) {
      console.error(`❌ Invalid calculation results: entryPrice=${entryPrice}, quantity=${quantity}`);
      return false;
    }

    // Get instrument info for proper validation
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (!instrumentInfo) {
      console.error(`❌ Could not get instrument info for ${symbol}`);
      return false;
    }

    // Use BybitInstrumentService for validation instead of config values
    const isValidOrder = BybitInstrumentService.validateOrder(symbol, entryPrice, quantity, instrumentInfo);
    if (!isValidOrder) {
      console.error(`❌ Order validation failed for ${symbol}`);
      return false;
    }

    const orderValue = quantity * entryPrice;
    
    // Validate against maximum order amount from config
    const maxOrderAmount = config.max_order_amount_usd || 100;
    if (orderValue > maxOrderAmount) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} exceeds maximum ${maxOrderAmount}`);
      return false;
    }

    console.log(`✅ Trade parameters valid for ${symbol}: $${orderValue.toFixed(2)}`);
    return true;
  }

  static async calculateQuantity(symbol: string, orderAmount: number, entryPrice: number, config: TradingConfigData): Promise<number> {
    // Get instrument info for proper quantity calculation
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (!instrumentInfo) {
      console.error(`❌ Could not get instrument info for ${symbol}, using fallback`);
      return this.calculateQuantityFallback(symbol, orderAmount, entryPrice, config);
    }

    // Calculate raw quantity
    const rawQuantity = orderAmount / entryPrice;
    
    // Use instrument precision for proper rounding
    const basePrecision = parseFloat(instrumentInfo.basePrecision);
    const adjustedQuantity = Math.floor(rawQuantity / basePrecision) * basePrecision;
    
    console.log(`📊 Quantity calculation for ${symbol}:`, {
      orderAmount: orderAmount.toFixed(2),
      entryPrice: entryPrice.toFixed(instrumentInfo.priceDecimals),
      rawQuantity: rawQuantity.toFixed(6),
      basePrecision: basePrecision,
      adjustedQuantity: parseFloat(adjustedQuantity.toFixed(instrumentInfo.quantityDecimals))
    });
    
    return parseFloat(adjustedQuantity.toFixed(instrumentInfo.quantityDecimals));
  }

  private static calculateQuantityFallback(symbol: string, orderAmount: number, entryPrice: number, config: TradingConfigData): number {
    // Fallback calculation using config
    const rawQuantity = orderAmount / entryPrice;
    const increment = config.quantity_increment_per_symbol?.[symbol] || 0.0001;
    const adjustedQuantity = Math.floor(rawQuantity / increment) * increment;
    
    console.log(`📊 Fallback quantity calculation for ${symbol}:`, {
      orderAmount: orderAmount.toFixed(2),
      entryPrice: entryPrice.toFixed(6),
      rawQuantity: rawQuantity.toFixed(6),
      increment: increment,
      adjustedQuantity: adjustedQuantity.toFixed(6)
    });
    
    return adjustedQuantity;
  }

  static async validateQuantityPrecision(symbol: string, quantity: number): Promise<boolean> {
    const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
    if (!instrumentInfo) {
      console.warn(`⚠️ Could not validate quantity precision for ${symbol}, allowing`);
      return true;
    }

    const basePrecision = parseFloat(instrumentInfo.basePrecision);
    const remainder = quantity % basePrecision;
    
    // Check if quantity is properly aligned with base precision
    const tolerance = basePrecision / 1000;
    
    if (remainder > tolerance && (basePrecision - remainder) > tolerance) {
      console.error(`❌ Quantity ${quantity} not aligned with base precision ${basePrecision} for ${symbol}`);
      return false;
    }
    
    return true;
  }

  static validatePriceRange(currentPrice: number, entryPrice: number, maxDeviationPercent: number = 5): boolean {
    const deviation = Math.abs((entryPrice - currentPrice) / currentPrice) * 100;
    
    if (deviation > maxDeviationPercent) {
      console.error(`❌ Entry price deviation too high: ${deviation.toFixed(2)}% (max: ${maxDeviationPercent}%)`);
      return false;
    }
    
    return true;
  }
}
