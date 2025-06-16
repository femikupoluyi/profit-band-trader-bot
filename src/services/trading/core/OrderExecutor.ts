
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { BybitPrecisionFormatter } from './BybitPrecisionFormatter';

export interface OrderExecutionResult {
  success: boolean;
  buyOrderId?: string;
  sellOrderId?: string;
  error?: string;
}

export class OrderExecutor {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
  }

  async executeBuyOrder(
    symbol: string,
    quantity: number,
    entryPrice: number
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      console.log(`\n🔄 ===== EXECUTING BUY ORDER FOR ${symbol} =====`);
      console.log(`📊 Raw Input: quantity=${quantity}, price=${entryPrice}`);

      // STEP 1: CRITICAL - Clear all caches and get fresh precision data
      BybitPrecisionFormatter.clearCache();
      console.log(`🧹 Cleared all caches for fresh precision data`);
      
      // STEP 2: CRITICAL - Format using ONLY BybitPrecisionFormatter with enhanced validation
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, entryPrice);
      
      console.log(`🔧 PRECISION FORMATTING RESULTS for ${symbol}:`);
      console.log(`  - Original Quantity: ${quantity} → Formatted: "${formattedQuantity}"`);
      console.log(`  - Original Price: ${entryPrice} → Formatted: "${formattedPrice}"`);

      // STEP 3: CRITICAL - Validate formatted values before proceeding
      const finalPrice = parseFloat(formattedPrice);
      const finalQuantity = parseFloat(formattedQuantity);
      
      console.log(`🔍 FORMATTED VALUES VALIDATION for ${symbol}:`);
      console.log(`  - Parsed Price: ${finalPrice} (from "${formattedPrice}")`);
      console.log(`  - Parsed Quantity: ${finalQuantity} (from "${formattedQuantity}")`);
      
      // STEP 4: CRITICAL - Pre-flight validation with exact formatted values
      const isValid = await BybitPrecisionFormatter.validateOrder(symbol, finalPrice, finalQuantity);
      
      if (!isValid) {
        const errorMsg = `PRE-FLIGHT VALIDATION FAILED for ${symbol}: qty="${formattedQuantity}", price="${formattedPrice}"`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.log(`✅ PRE-FLIGHT VALIDATION PASSED for ${symbol}`);

      // STEP 5: CRITICAL - Additional safety checks to prevent decimal errors
      console.log(`🔍 ADDITIONAL SAFETY CHECKS for ${symbol}:`);
      
      // Check for scientific notation (should not happen but double-check)
      if (formattedQuantity.includes('e') || formattedQuantity.includes('E')) {
        throw new Error(`Quantity in scientific notation: ${formattedQuantity}`);
      }
      
      if (formattedPrice.includes('e') || formattedPrice.includes('E')) {
        throw new Error(`Price in scientific notation: ${formattedPrice}`);
      }

      // Check decimal places by counting them directly
      const quantityDecimals = formattedQuantity.includes('.') ? formattedQuantity.split('.')[1].length : 0;
      const priceDecimals = formattedPrice.includes('.') ? formattedPrice.split('.')[1].length : 0;
      
      console.log(`📊 Decimal count verification: quantity=${quantityDecimals} decimals, price=${priceDecimals} decimals`);

      if (quantityDecimals > 8) {
        throw new Error(`Quantity has too many decimals (${quantityDecimals}): ${formattedQuantity}`);
      }

      if (priceDecimals > 8) {
        throw new Error(`Price has too many decimals (${priceDecimals}): ${formattedPrice}`);
      }

      console.log(`✅ ALL SAFETY CHECKS PASSED for ${symbol}`);

      // STEP 6: Place the buy order with validated string values
      console.log(`📤 PLACING BYBIT ORDER for ${symbol}:`);
      console.log(`  - Symbol: ${symbol}`);
      console.log(`  - Side: Buy`);
      console.log(`  - Type: Limit`);
      console.log(`  - Quantity: "${formattedQuantity}" (${quantityDecimals} decimals)`);
      console.log(`  - Price: "${formattedPrice}" (${priceDecimals} decimals)`);
      console.log(`  - Time in Force: GTC`);

      const buyOrderResult = await this.bybitService.placeOrder({
        category: 'spot',
        symbol: symbol,
        side: 'Buy',
        orderType: 'Limit',
        qty: formattedQuantity,
        price: formattedPrice,
        timeInForce: 'GTC'
      });

      if (buyOrderResult.retCode !== 0) {
        const errorMsg = `Bybit buy order failed: ${buyOrderResult.retMsg}`;
        console.error(`❌ ${errorMsg}`);
        console.error(`📊 Failed order details:`, {
          symbol,
          formattedQuantity,
          formattedPrice,
          quantityDecimals,
          priceDecimals,
          originalQuantity: quantity,
          originalPrice: entryPrice,
          response: buyOrderResult
        });
        throw new Error(errorMsg);
      }

      const buyOrderId = buyOrderResult.result?.orderId;
      if (!buyOrderId) {
        throw new Error('No order ID returned from Bybit buy order');
      }

      console.log(`✅ BUY ORDER PLACED SUCCESSFULLY: ${buyOrderId}`);
      
      await this.logger.logSuccess(`BUY order placed for ${symbol}`, {
        symbol,
        orderId: buyOrderId,
        formattedQuantity,
        formattedPrice,
        originalQuantity: quantity,
        originalPrice: entryPrice,
        quantityDecimals,
        priceDecimals,
        validationPassed: true
      });

      return { success: true, orderId: buyOrderId };

    } catch (error) {
      console.error(`❌ CRITICAL ERROR placing BUY order for ${symbol}:`, error);
      console.error(`📊 Complete error context:`, {
        symbol,
        originalQuantity: quantity,
        originalPrice: entryPrice,
        error: error.message,
        stack: error.stack
      });
      
      await this.logger.logError(`BUY order failed for ${symbol}`, error, {
        symbol,
        quantity,
        entryPrice,
        errorType: 'order_execution_failed',
        errorDetails: error.message
      });
      
      return { success: false, error: error.message };
    }
  }

  async executeSellOrder(
    symbol: string,
    quantity: number,
    price: number,
    instrumentInfo: any
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      console.log(`\n🔄 ===== EXECUTING SELL ORDER FOR ${symbol} =====`);
      console.log(`📊 Raw Input: quantity=${quantity}, price=${price}`);

      // CRITICAL: Clear cache and format using ONLY BybitPrecisionFormatter
      BybitPrecisionFormatter.clearCache();
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, price);

      console.log(`🔧 PRECISION FORMATTING RESULTS for ${symbol}:`);
      console.log(`  - Original Quantity: ${quantity} → Formatted: "${formattedQuantity}"`);
      console.log(`  - Original Price: ${price} → Formatted: "${formattedPrice}"`);

      // CRITICAL: Pre-flight validation with formatted values
      const finalPrice = parseFloat(formattedPrice);
      const finalQuantity = parseFloat(formattedQuantity);
      const isValid = await BybitPrecisionFormatter.validateOrder(symbol, finalPrice, finalQuantity);
      
      if (!isValid) {
        throw new Error(`Sell order pre-flight validation failed for ${symbol}: qty="${formattedQuantity}", price="${formattedPrice}"`);
      }

      // Place the sell order with validated string values
      const sellOrderResult = await this.bybitService.placeOrder({
        category: 'spot',
        symbol: symbol,
        side: 'Sell',
        orderType: 'Limit',
        qty: formattedQuantity,
        price: formattedPrice,
        timeInForce: 'GTC'
      });

      if (sellOrderResult.retCode !== 0) {
        throw new Error(`Bybit sell order failed: ${sellOrderResult.retMsg}`);
      }

      const sellOrderId = sellOrderResult.result?.orderId;
      if (!sellOrderId) {
        throw new Error('No order ID returned from Bybit sell order');
      }

      console.log(`✅ SELL ORDER PLACED SUCCESSFULLY: ${sellOrderId}`);
      await this.logger.logSuccess(`SELL order placed for ${symbol}`, {
        symbol,
        orderId: sellOrderId,
        formattedQuantity,
        formattedPrice,
        originalQuantity: quantity,
        originalPrice: price
      });

      return { success: true, orderId: sellOrderId };

    } catch (error) {
      console.error(`❌ ERROR placing SELL order for ${symbol}:`, error);
      await this.logger.logError(`SELL order failed for ${symbol}`, error, {
        symbol,
        quantity,
        price,
        errorDetails: error.message
      });
      return { success: false, error: error.message };
    }
  }
}
