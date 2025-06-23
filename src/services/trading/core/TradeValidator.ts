
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export interface TradeValidationResult {
  isValid: boolean;
  error?: string;
  formattedPrice: string;
  formattedQuantity: string;
  calculatedOrderValue: number;
}

export class TradeValidator {
  static async validateTrade(
    symbol: string,
    quantity: number,
    price: number,
    maxOrderAmountUsd: number
  ): Promise<TradeValidationResult> {
    try {
      console.log(`🧮 TradeValidator: Calculating quantity for ${symbol}`);
      
      // Clear cache for fresh precision data
      BybitPrecisionFormatter.clearCache();
      
      // Calculate order value BEFORE formatting to avoid precision issues
      const orderValue = quantity * price;
      console.log(`💰 Order value calculation: ${quantity} × ${price} = ${orderValue.toFixed(2)}`);
      
      // FIXED: Use strict greater than (not greater than or equal)
      if (orderValue > maxOrderAmountUsd) {
        console.log(`❌ TradeValidator: Order value ${orderValue.toFixed(2)} exceeds maximum ${maxOrderAmountUsd}`);
        return {
          isValid: false,
          error: `Order value $${orderValue.toFixed(2)} exceeds maximum $${maxOrderAmountUsd}`,
          formattedPrice: '0',
          formattedQuantity: '0',
          calculatedOrderValue: orderValue
        };
      }

      // Format price and quantity with proper precision
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, price);
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      
      console.log(`🔧 TradeValidator formatted values: price="${formattedPrice}" (${price}), quantity="${formattedQuantity}" (${quantity})`);
      
      // Validate the formatted order meets Bybit requirements
      const isValidOrder = await BybitPrecisionFormatter.validateOrder(symbol, parseFloat(formattedPrice), parseFloat(formattedQuantity));
      
      if (!isValidOrder) {
        console.log(`❌ TradeValidator: Bybit validation failed for ${symbol}`);
        return {
          isValid: false,
          error: 'Trade validation failed - order does not meet Bybit requirements',
          formattedPrice,
          formattedQuantity,
          calculatedOrderValue: orderValue
        };
      }

      console.log(`✅ TradeValidator: All validations passed for ${symbol}`);
      return {
        isValid: true,
        formattedPrice,
        formattedQuantity,
        calculatedOrderValue: orderValue
      };
      
    } catch (error) {
      console.error(`❌ TradeValidator error for ${symbol}:`, error);
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        formattedPrice: '0',
        formattedQuantity: '0',
        calculatedOrderValue: 0
      };
    }
  }

  static async calculateOptimalQuantity(
    symbol: string,
    targetOrderValueUsd: number,
    entryPrice: number
  ): Promise<number> {
    try {
      // Calculate base quantity
      const baseQuantity = targetOrderValueUsd / entryPrice;
      
      // Get instrument info for proper rounding
      BybitPrecisionFormatter.clearCache();
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, baseQuantity);
      
      // Return the properly formatted quantity as a number
      return parseFloat(formattedQuantity);
      
    } catch (error) {
      console.error(`❌ Error calculating optimal quantity for ${symbol}:`, error);
      throw error;
    }
  }

  // ADDED: Missing method that SignalCreationService and SignalValidationService expect
  static async calculateQuantity(
    symbol: string,
    maxOrderAmountUsd: number,
    entryPrice: number,
    config: TradingConfigData
  ): Promise<number> {
    return this.calculateOptimalQuantity(symbol, maxOrderAmountUsd, entryPrice);
  }

  // ADDED: Missing method that SignalCreationService and SignalValidationService expect
  static async validateTradeParameters(
    symbol: string,
    quantity: number,
    price: number,
    config: TradingConfigData
  ): Promise<boolean> {
    try {
      const validation = await this.validateTrade(
        symbol,
        quantity,
        price,
        config.max_order_amount_usd || 100
      );
      return validation.isValid;
    } catch (error) {
      console.error(`❌ Error validating trade parameters for ${symbol}:`, error);
      return false;
    }
  }
}
