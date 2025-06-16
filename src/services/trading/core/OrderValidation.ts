
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';

export interface OrderValidationResult {
  isValid: boolean;
  formattedQuantity: string;
  formattedPrice: string;
  error?: string;
  validationDetails: {
    quantityDecimals: number;
    priceDecimals: number;
    finalPrice: number;
    finalQuantity: number;
  };
}

export class OrderValidation {
  static async validateAndFormatOrder(
    symbol: string,
    quantity: number,
    price: number
  ): Promise<OrderValidationResult> {
    try {
      console.log(`\n🔍 ===== ORDER VALIDATION FOR ${symbol} =====`);
      console.log(`📊 Input: quantity=${quantity}, price=${price}`);

      // Clear cache to ensure fresh precision data
      BybitPrecisionFormatter.clearCache();

      // Format with enhanced error handling
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, price);

      console.log(`🔧 Formatted values: quantity="${formattedQuantity}", price="${formattedPrice}"`);

      // Parse back to numbers for validation
      const finalPrice = parseFloat(formattedPrice);
      const finalQuantity = parseFloat(formattedQuantity);

      // Validate the formatting didn't break the values
      if (isNaN(finalPrice) || isNaN(finalQuantity) || finalPrice <= 0 || finalQuantity <= 0) {
        throw new Error(`Invalid formatted values: price=${finalPrice}, quantity=${finalQuantity}`);
      }

      // Count decimal places manually for safety
      const quantityDecimals = formattedQuantity.includes('.') ? formattedQuantity.split('.')[1].length : 0;
      const priceDecimals = formattedPrice.includes('.') ? formattedPrice.split('.')[1].length : 0;

      console.log(`📊 Decimal validation: quantity=${quantityDecimals} decimals, price=${priceDecimals} decimals`);

      // Safety checks
      if (quantityDecimals > 8 || priceDecimals > 8) {
        throw new Error(`Too many decimals: quantity=${quantityDecimals}, price=${priceDecimals}`);
      }

      // Check for scientific notation
      if (formattedQuantity.toLowerCase().includes('e') || formattedPrice.toLowerCase().includes('e')) {
        throw new Error(`Scientific notation detected: qty="${formattedQuantity}", price="${formattedPrice}"`);
      }

      // Final Bybit validation
      const isValid = await BybitPrecisionFormatter.validateOrder(symbol, finalPrice, finalQuantity);
      
      if (!isValid) {
        throw new Error(`Bybit validation failed for ${symbol}`);
      }

      console.log(`✅ Order validation passed for ${symbol}`);

      return {
        isValid: true,
        formattedQuantity,
        formattedPrice,
        validationDetails: {
          quantityDecimals,
          priceDecimals,
          finalPrice,
          finalQuantity
        }
      };

    } catch (error) {
      console.error(`❌ Order validation failed for ${symbol}:`, error);
      
      return {
        isValid: false,
        formattedQuantity: '0',
        formattedPrice: '0',
        error: error.message,
        validationDetails: {
          quantityDecimals: 0,
          priceDecimals: 0,
          finalPrice: 0,
          finalQuantity: 0
        }
      };
    }
  }
}
