
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { OrderValidation } from './OrderValidation';

export interface OrderExecutionResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export class OrderExecution {
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
  ): Promise<OrderExecutionResult> {
    try {
      console.log(`\n🎯 ===== EXECUTING BUY ORDER FOR ${symbol} =====`);
      console.log(`📊 Parameters: quantity=${quantity}, price=${entryPrice}`);

      // Step 1: Validate and format the order
      const validation = await OrderValidation.validateAndFormatOrder(symbol, quantity, entryPrice);
      
      if (!validation.isValid) {
        const errorMsg = `Order validation failed: ${validation.error}`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.log(`✅ Order validation passed for ${symbol}`);
      console.log(`📊 Final values: qty="${validation.formattedQuantity}" (${validation.validationDetails.quantityDecimals} decimals), price="${validation.formattedPrice}" (${validation.validationDetails.priceDecimals} decimals)`);

      // Step 2: Place the order with Bybit
      console.log(`📤 Placing Bybit order for ${symbol}...`);
      
      const buyOrderResult = await this.bybitService.placeOrder({
        category: 'spot',
        symbol: symbol,
        side: 'Buy',
        orderType: 'Limit',
        qty: validation.formattedQuantity,
        price: validation.formattedPrice,
        timeInForce: 'GTC'
      });

      if (buyOrderResult.retCode !== 0) {
        const errorMsg = `Bybit buy order failed: ${buyOrderResult.retMsg}`;
        console.error(`❌ ${errorMsg}`);
        console.error(`📊 Order details:`, {
          symbol,
          quantity: validation.formattedQuantity,
          price: validation.formattedPrice,
          validationDetails: validation.validationDetails,
          bybitResponse: buyOrderResult
        });
        throw new Error(errorMsg);
      }

      const buyOrderId = buyOrderResult.result?.orderId;
      if (!buyOrderId) {
        throw new Error('No order ID returned from Bybit');
      }

      console.log(`✅ BUY ORDER EXECUTED SUCCESSFULLY: ${buyOrderId}`);
      
      await this.logger.logSuccess(`BUY order executed for ${symbol}`, {
        symbol,
        orderId: buyOrderId,
        formattedQuantity: validation.formattedQuantity,
        formattedPrice: validation.formattedPrice,
        validationDetails: validation.validationDetails
      });

      return { success: true, orderId: buyOrderId };

    } catch (error) {
      console.error(`❌ CRITICAL ERROR executing BUY order for ${symbol}:`, error);
      
      await this.logger.logError(`BUY order execution failed for ${symbol}`, error, {
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
    price: number
  ): Promise<OrderExecutionResult> {
    try {
      console.log(`\n🎯 ===== EXECUTING SELL ORDER FOR ${symbol} =====`);
      console.log(`📊 Parameters: quantity=${quantity}, price=${price}`);

      // Step 1: Validate and format the order
      const validation = await OrderValidation.validateAndFormatOrder(symbol, quantity, price);
      
      if (!validation.isValid) {
        const errorMsg = `Sell order validation failed: ${validation.error}`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.log(`✅ Sell order validation passed for ${symbol}`);

      // Step 2: Place the sell order with Bybit
      const sellOrderResult = await this.bybitService.placeOrder({
        category: 'spot',
        symbol: symbol,
        side: 'Sell',
        orderType: 'Limit',
        qty: validation.formattedQuantity,
        price: validation.formattedPrice,
        timeInForce: 'GTC'
      });

      if (sellOrderResult.retCode !== 0) {
        const errorMsg = `Bybit sell order failed: ${sellOrderResult.retMsg}`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const sellOrderId = sellOrderResult.result?.orderId;
      if (!sellOrderId) {
        throw new Error('No order ID returned from Bybit sell order');
      }

      console.log(`✅ SELL ORDER EXECUTED SUCCESSFULLY: ${sellOrderId}`);
      
      await this.logger.logSuccess(`SELL order executed for ${symbol}`, {
        symbol,
        orderId: sellOrderId,
        formattedQuantity: validation.formattedQuantity,
        formattedPrice: validation.formattedPrice
      });

      return { success: true, orderId: sellOrderId };

    } catch (error) {
      console.error(`❌ ERROR executing SELL order for ${symbol}:`, error);
      
      await this.logger.logError(`SELL order execution failed for ${symbol}`, error, {
        symbol,
        quantity,
        price
      });
      
      return { success: false, error: error.message };
    }
  }
}
