
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
      console.log(`📊 Input: ${quantity} @ ${entryPrice}`);

      // CRITICAL: Clear cache and get fresh precision data
      BybitPrecisionFormatter.clearCache();
      
      // CRITICAL: Format using Bybit precision formatter with enhanced validation
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, entryPrice);
      
      console.log(`🔧 FORMATTED VALUES for ${symbol}:
        - Quantity: "${formattedQuantity}" (original: ${quantity})
        - Price: "${formattedPrice}" (original: ${entryPrice})`);

      // CRITICAL: Pre-flight validation with formatted values
      const finalPrice = parseFloat(formattedPrice);
      const finalQuantity = parseFloat(formattedQuantity);
      
      console.log(`🔍 PRE-FLIGHT VALIDATION for ${symbol}:`);
      
      const isValid = await BybitPrecisionFormatter.validateOrder(symbol, finalPrice, finalQuantity);
      
      if (!isValid) {
        const errorMsg = `PRE-FLIGHT VALIDATION FAILED: qty="${formattedQuantity}", price="${formattedPrice}"`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.log(`✅ PRE-FLIGHT VALIDATION PASSED for ${symbol}`);

      // CRITICAL: Additional manual validation checks
      console.log(`🔍 MANUAL VALIDATION CHECKS for ${symbol}:`);
      
      // Check for scientific notation (should not happen but double-check)
      if (formattedQuantity.includes('e') || formattedQuantity.includes('E')) {
        throw new Error(`Quantity in scientific notation: ${formattedQuantity}`);
      }
      
      if (formattedPrice.includes('e') || formattedPrice.includes('E')) {
        throw new Error(`Price in scientific notation: ${formattedPrice}`);
      }

      // Check for excessive decimals by counting decimal places
      const quantityDecimals = formattedQuantity.includes('.') ? formattedQuantity.split('.')[1].length : 0;
      const priceDecimals = formattedPrice.includes('.') ? formattedPrice.split('.')[1].length : 0;
      
      console.log(`📊 Decimal places: quantity=${quantityDecimals}, price=${priceDecimals}`);

      if (quantityDecimals > 8) {
        throw new Error(`Quantity has too many decimals (${quantityDecimals}): ${formattedQuantity}`);
      }

      if (priceDecimals > 8) {
        throw new Error(`Price has too many decimals (${priceDecimals}): ${formattedPrice}`);
      }

      console.log(`✅ MANUAL VALIDATION PASSED for ${symbol}`);

      // Place the buy order with string values
      console.log(`📤 PLACING ORDER on Bybit for ${symbol}:
        - Symbol: ${symbol}
        - Side: Buy
        - Type: Limit
        - Quantity: "${formattedQuantity}"
        - Price: "${formattedPrice}"
        - Time in Force: GTC`);

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
        console.error(`📊 Order details that failed:`, {
          symbol,
          qty: formattedQuantity,
          price: formattedPrice,
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
        quantity: formattedQuantity,
        price: formattedPrice,
        originalQuantity: quantity,
        originalPrice: entryPrice,
        validationPassed: true
      });

      return { success: true,OrderId: buyOrderId };

    } catch (error) {
      console.error(`❌ CRITICAL ERROR placing BUY order for ${symbol}:`, error);
      console.error(`📊 Failed order details:`, {
        symbol,
        originalQuantity: quantity,
        originalPrice: entryPrice,
        error: error.message
      });
      
      await this.logger.logError(`BUY order failed for ${symbol}`, error, {
        symbol,
        quantity,
        entryPrice,
        errorType: 'order_execution_failed'
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
      console.log(`📊 Input: ${quantity} @ ${price}`);

      // CRITICAL: Clear cache and format using Bybit precision formatter
      BybitPrecisionFormatter.clearCache();
      const formattedQuantity = await BybitPrecisionFormatter.formatQuantity(symbol, quantity);
      const formattedPrice = await BybitPrecisionFormatter.formatPrice(symbol, price);

      console.log(`🔧 FORMATTED VALUES for ${symbol}:
        - Quantity: "${formattedQuantity}" (original: ${quantity})
        - Price: "${formattedPrice}" (original: ${price})`);

      // CRITICAL: Pre-flight validation with formatted values
      const finalPrice = parseFloat(formattedPrice);
      const finalQuantity = parseFloat(formattedQuantity);
      const isValid = await BybitPrecisionFormatter.validateOrder(symbol, finalPrice, finalQuantity);
      
      if (!isValid) {
        throw new Error(`Sell order pre-flight validation failed: qty="${formattedQuantity}", price="${formattedPrice}"`);
      }

      // Place the sell order with string values
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
        quantity: formattedQuantity,
        price: formattedPrice,
        originalQuantity: quantity,
        originalPrice: price
      });

      return { success: true, orderId: sellOrderId };

    } catch (error) {
      console.error(`❌ ERROR placing SELL order for ${symbol}:`, error);
      await this.logger.logError(`SELL order failed for ${symbol}`, error, {
        symbol,
        quantity,
        price
      });
      return { success: false, error: error.message };
    }
  }
}
