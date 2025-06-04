import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { PositionChecker } from './positionChecker';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradeValidation } from './tradeValidation';

export class SignalExecutionService {
  private userId: string;
  private bybitService: BybitService;
  private positionChecker: PositionChecker;
  private config: TradingConfigData;

  constructor(userId: string, config: TradingConfigData, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.positionChecker = new PositionChecker(userId);
    this.config = config;
    
    console.log('SignalExecutionService config validation:', {
      entryOffset: this.config.entry_offset_percent,
      takeProfit: this.config.take_profit_percent,
      maxOrderAmount: this.config.max_order_amount_usd,
      maxPositionsPerPair: this.config.max_positions_per_pair,
      newSupportThreshold: this.config.new_support_threshold_percent
    });
  }

  private formatPriceForSymbol(symbol: string, price: number): string {
    // Price precision rules for different symbols
    const pricePrecisionRules: Record<string, number> = {
      'BTCUSDT': 1,    // BTC prices to 1 decimal place (e.g., 104776.8)
      'ETHUSDT': 2,    // ETH prices to 2 decimal places
      'BNBUSDT': 2,    // BNB prices to 2 decimal places
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

    const decimals = pricePrecisionRules[symbol] || 2; // Default to 2 decimals
    const formattedPrice = price.toFixed(decimals);
    
    console.log(`Formatting price for ${symbol}: ${price} -> ${formattedPrice} (${decimals} decimals)`);
    return formattedPrice;
  }

  async executeSignal(signal: any): Promise<void> {
    console.log(`\n🎯 Processing signal for ${signal.symbol}:`);
    console.log(`  Signal Type: ${signal.signal_type}`);
    console.log(`  Price: $${signal.price}`);
    console.log(`  Confidence: ${signal.confidence}%`);
    console.log(`  Using config: Entry Offset ${this.config.entry_offset_percent}%, Take Profit ${this.config.take_profit_percent}%, Max Order Amount: $${this.config.max_order_amount_usd}, Max Positions per Pair: ${this.config.max_positions_per_pair}`);

    try {
      // Only process buy signals
      if (signal.signal_type !== 'buy') {
        console.log(`❌ Skipping non-buy signal for ${signal.symbol}`);
        return;
      }

      // Use config values directly and enforce them with slippage tolerance
      const entryOffsetPercent = this.config.entry_offset_percent;
      const takeProfitPercent = this.config.take_profit_percent;
      const maxOrderAmountUsd = this.config.max_order_amount_usd;
      const maxPositionsPerPair = this.config.max_positions_per_pair;
      const newSupportThresholdPercent = this.config.new_support_threshold_percent;
      const maxActivePairs = this.config.max_active_pairs;

      // Allow 5% slippage tolerance for order values
      const slippageTolerance = 0.05; // 5%
      const maxOrderAmountWithSlippage = maxOrderAmountUsd * (1 + slippageTolerance);

      console.log(`  🔒 CONFIG VALUES with 5% slippage tolerance - Entry: ${entryOffsetPercent}%, TP: ${takeProfitPercent}%, MAX ORDER: $${maxOrderAmountUsd} (+ 5% slippage = $${maxOrderAmountWithSlippage.toFixed(2)})`);

      // Validate max active pairs
      const canOpenNewPair = await this.positionChecker.validateMaxActivePairs(maxActivePairs);
      if (!canOpenNewPair) {
        console.log(`❌ Cannot open new position: max active pairs (${maxActivePairs}) reached`);
        await this.logActivity('signal_rejected', `Signal rejected for ${signal.symbol}: max active pairs reached`, {
          symbol: signal.symbol,
          maxActivePairs,
          reason: 'max_active_pairs_exceeded'
        });
        return;
      }

      // For support-based trading, always allow new positions if no active trades exist
      // This ensures all 10 trading pairs can have limit orders placed
      const hasActivePosition = await this.positionChecker.hasOpenPosition(signal.symbol);
      if (hasActivePosition) {
        // If there's an active position, check if we can add more based on support levels
        const canOpenNewPosition = await this.positionChecker.canOpenNewPositionWithLowerSupport(
          signal.symbol,
          signal.price,
          newSupportThresholdPercent,
          maxPositionsPerPair
        );

        if (!canOpenNewPosition) {
          console.log(`❌ Cannot open additional position for ${signal.symbol}: position limits reached or support threshold not met`);
          console.log(`  Max positions per pair: ${maxPositionsPerPair}`);
          console.log(`  New support threshold: ${newSupportThresholdPercent}%`);
          await this.logActivity('signal_rejected', `Signal rejected for ${signal.symbol}: position limits reached or support threshold not met`, {
            symbol: signal.symbol,
            maxPositionsPerPair,
            newSupportThreshold: newSupportThresholdPercent,
            reason: 'position_limit_or_support_threshold'
          });
          return;
        }
      } else {
        console.log(`✅ No active position for ${signal.symbol}, proceeding with limit order placement`);
      }

      // Calculate entry price with offset using config value (support-based entry)
      const entryPrice = signal.price * (1 + entryOffsetPercent / 100);
      console.log(`📈 Support-based entry price calculated: $${entryPrice.toFixed(6)} (${entryOffsetPercent}% above support)`);

      // Calculate quantity based on max order amount (with slippage tolerance for validation)
      const quantity = maxOrderAmountUsd / entryPrice;
      const actualOrderValue = quantity * entryPrice;
      
      console.log(`📊 Order quantity: ${quantity.toFixed(6)} (based on $${maxOrderAmountUsd} max order)`);
      console.log(`💰 Actual order value: $${actualOrderValue.toFixed(2)} (limit with slippage: $${maxOrderAmountWithSlippage.toFixed(2)})`);

      // ENFORCE: Order value with slippage tolerance
      if (actualOrderValue > maxOrderAmountWithSlippage) {
        console.error(`❌ ORDER EXCEEDS SLIPPAGE LIMIT: Order value $${actualOrderValue.toFixed(2)} exceeds maximum with 5% slippage $${maxOrderAmountWithSlippage.toFixed(2)}`);
        await this.logActivity('order_rejected', `Order rejected for ${signal.symbol}: exceeds max order amount with slippage`, {
          symbol: signal.symbol,
          actualOrderValue: actualOrderValue.toFixed(2),
          configuredMaximum: maxOrderAmountUsd,
          maxWithSlippage: maxOrderAmountWithSlippage.toFixed(2),
          reason: 'exceeds_max_order_amount_with_slippage'
        });
        return;
      }

      // Format quantity for Bybit precision requirements
      const formattedQuantity = TradeValidation.getFormattedQuantity(signal.symbol, quantity);
      const formattedOrderValue = parseFloat(formattedQuantity) * entryPrice;

      // Final validation after formatting - ensure we still comply with slippage limits
      if (formattedOrderValue > maxOrderAmountWithSlippage) {
        console.error(`❌ POST-FORMATTING SLIPPAGE VIOLATION: Formatted order value $${formattedOrderValue.toFixed(2)} exceeds maximum with slippage $${maxOrderAmountWithSlippage.toFixed(2)}`);
        await this.logActivity('order_rejected', `Order rejected for ${signal.symbol}: formatted quantity exceeds max order amount with slippage`, {
          symbol: signal.symbol,
          formattedOrderValue: formattedOrderValue.toFixed(2),
          configuredMaximum: maxOrderAmountUsd,
          maxWithSlippage: maxOrderAmountWithSlippage.toFixed(2),
          originalQuantity: quantity,
          formattedQuantity,
          reason: 'formatted_quantity_exceeds_max_with_slippage'
        });
        return;
      }

      // Validate minimum order value
      if (!TradeValidation.isValidOrderValue(signal.symbol, parseFloat(formattedQuantity), entryPrice)) {
        await this.logActivity('order_rejected', `Order rejected for ${signal.symbol}: value below minimum`, {
          symbol: signal.symbol,
          quantity: formattedQuantity,
          price: entryPrice,
          orderValue: parseFloat(formattedQuantity) * entryPrice,
          reason: 'order_value_too_low'
        });
        return;
      }

      // Validate calculation results
      if (isNaN(entryPrice) || isNaN(quantity) || quantity <= 0 || entryPrice <= 0) {
        console.error(`❌ Invalid calculation results: entryPrice=${entryPrice}, quantity=${quantity}`);
        await this.logActivity('calculation_error', `Invalid calculation for ${signal.symbol}`, {
          entryPrice,
          quantity,
          signal,
          config: {
            entryOffsetPercent,
            maxOrderAmountUsd
          }
        });
        return;
      }

      // 🔒 ALWAYS USE LIMIT ORDERS for support-based trading with take profit
      console.log(`💡 Using LIMIT order for support-based entry at $${entryPrice.toFixed(6)} with ${takeProfitPercent}% take profit target`);

      // Execute the trade with slippage tolerance - ALWAYS LIMIT ORDER with take profit
      await this.executeBuyOrder(signal.symbol, entryPrice, parseFloat(formattedQuantity), signal, takeProfitPercent, 'limit', maxOrderAmountUsd, maxOrderAmountWithSlippage);

    } catch (error) {
      console.error(`Error executing signal for ${signal.symbol}:`, error);
      await this.logActivity('execution_error', `Signal execution failed for ${signal.symbol}`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        signal: signal 
      });
    }
  }

  private async executeBuyOrder(
    symbol: string, 
    price: number, 
    quantity: number, 
    signal: any, 
    takeProfitPercent: number, 
    orderType: 'limit', 
    configuredMaxOrderAmount: number,
    maxOrderAmountWithSlippage: number
  ): Promise<void> {
    try {
      const actualOrderValue = quantity * price;
      
      console.log(`\n💰 Executing LIMIT buy order for ${symbol} with take profit:`);
      console.log(`  Entry Price: $${price.toFixed(6)}`);
      console.log(`  Quantity: ${quantity.toFixed(6)}`);
      console.log(`  Total Value: $${actualOrderValue.toFixed(2)}`);
      console.log(`  🔒 Configured Max: $${configuredMaxOrderAmount}`);
      console.log(`  🔒 Max with Slippage: $${maxOrderAmountWithSlippage.toFixed(2)}`);
      console.log(`  ✅ Within Slippage Limit: ${actualOrderValue <= maxOrderAmountWithSlippage ? 'YES' : 'NO'}`);
      console.log(`  🎯 Take Profit Target: ${takeProfitPercent}% (Exit at $${(price * (1 + takeProfitPercent / 100)).toFixed(6)})`);

      // Final validation - ensure order value doesn't exceed slippage limit
      if (actualOrderValue > maxOrderAmountWithSlippage) {
        throw new Error(`Order value $${actualOrderValue.toFixed(2)} exceeds maximum with slippage $${maxOrderAmountWithSlippage.toFixed(2)}`);
      }

      // Validate inputs before order placement
      if (isNaN(price) || isNaN(quantity) || price <= 0 || quantity <= 0) {
        throw new Error(`Invalid trade parameters: price=${price}, quantity=${quantity}`);
      }

      let bybitOrderId = null;
      let tradeStatus: 'pending' = 'pending'; // Limit orders start as pending
      let actualFillPrice = price;

      // Try to place real order on Bybit
      try {
        console.log(`🔄 Placing LIMIT order on Bybit for ${symbol} with take profit...`);
        
        const formattedQuantity = quantity.toString();
        // Use the proper price formatting method for the symbol
        const formattedPrice = this.formatPriceForSymbol(symbol, price);
        
        console.log(`  Formatted quantity: ${formattedQuantity}`);
        console.log(`  Formatted price: ${formattedPrice} (original: ${price})`);

        // Place buy order on Bybit - ALWAYS LIMIT ORDER
        const orderParams = {
          category: 'spot' as const,
          symbol: symbol,
          side: 'Buy' as const,
          orderType: 'Limit' as const,
          qty: formattedQuantity,
          price: formattedPrice,
          timeInForce: 'GTC' as const
        };

        console.log('Sending LIMIT order request to Bybit:', orderParams);

        const orderResult = await this.bybitService.placeOrder(orderParams);
        console.log('Bybit order response:', orderResult);

        if (orderResult && orderResult.retCode === 0 && orderResult.result?.orderId) {
          bybitOrderId = orderResult.result.orderId;
          
          console.log(`✅ Successfully placed LIMIT order on Bybit: ${bybitOrderId}`);
          console.log(`  Order status: ${tradeStatus}`);
          console.log(`  Entry price: $${actualFillPrice.toFixed(6)}`);
          console.log(`  Take profit target: ${takeProfitPercent}%`);
          
          await this.logActivity('order_placed', `LIMIT order placed successfully on Bybit for ${symbol} with take profit within slippage limits`, {
            bybitOrderId,
            orderResult,
            symbol,
            quantity: formattedQuantity,
            price: actualFillPrice,
            formattedPrice: formattedPrice,
            orderType: 'Limit Buy',
            status: tradeStatus,
            configuredMaxOrderAmount,
            maxOrderAmountWithSlippage: maxOrderAmountWithSlippage.toFixed(2),
            actualOrderValue: actualOrderValue.toFixed(2),
            takeProfitTarget: takeProfitPercent,
            takeProfitPrice: (price * (1 + takeProfitPercent / 100)).toFixed(6),
            orderStrategy: 'support_based_limit_with_take_profit',
            slippageUsed: ((actualOrderValue - configuredMaxOrderAmount) / configuredMaxOrderAmount * 100).toFixed(2) + '%'
          });
        } else {
          console.error(`❌ Bybit order failed - retCode: ${orderResult?.retCode}, retMsg: ${orderResult?.retMsg}`);
          await this.logActivity('order_failed', `Bybit order failed for ${symbol}`, {
            orderResult,
            symbol,
            formattedPrice: formattedPrice,
            originalPrice: price,
            reason: 'bybit_order_failed'
          });
          // Don't create a database record if Bybit order failed
          return;
        }
      } catch (bybitError) {
        console.error(`❌ Failed to place order on Bybit: ${bybitError instanceof Error ? bybitError.message : 'Unknown error'}`);
        await this.logActivity('order_failed', `Bybit order error for ${symbol}`, {
          bybitError: bybitError instanceof Error ? bybitError.message : 'Unknown error',
          symbol,
          reason: 'bybit_api_error'
        });
        // Don't create a database record if Bybit order failed
        return;
      }

      // Create trade record in database only if Bybit order was successful
      const { data: trade, error } = await supabase
        .from('trades')
        .insert({
          user_id: this.userId,
          symbol,
          side: 'buy',
          order_type: 'limit',
          price: actualFillPrice,
          quantity: quantity,
          status: tradeStatus,
          bybit_order_id: bybitOrderId,
        })
        .select()
        .single();

      if (error) {
        console.error('Database error inserting trade:', error);
        throw error;
      }

      console.log(`✅ Trade record created successfully for ${symbol}`);
      console.log(`  Trade ID: ${trade.id}`);
      console.log(`  Bybit Order ID: ${bybitOrderId}`);
      console.log(`  Status: ${tradeStatus}`);
      console.log(`  Order Type: LIMIT with take profit`);
      console.log(`  Entry Price: $${actualFillPrice.toFixed(6)}`);
      console.log(`  Take Profit Target: $${(actualFillPrice * (1 + takeProfitPercent / 100)).toFixed(6)} (${takeProfitPercent}%)`);
      console.log(`  🔒 Slippage Compliance: Order value $${actualOrderValue.toFixed(2)} ≤ Max with slippage $${maxOrderAmountWithSlippage.toFixed(2)}`);

      await this.logActivity('trade_executed', `LIMIT buy order executed successfully for ${symbol} with take profit within slippage limits`, {
        symbol,
        price: actualFillPrice,
        quantity: quantity,
        totalValue: actualOrderValue,
        tradeId: trade.id,
        bybitOrderId,
        orderType: 'limit',
        status: tradeStatus,
        takeProfitTarget: takeProfitPercent,
        takeProfitPrice: (actualFillPrice * (1 + takeProfitPercent / 100)).toFixed(6),
        entryOffset: this.config.entry_offset_percent,
        configuredMaxOrderAmount,
        maxOrderAmountWithSlippage: maxOrderAmountWithSlippage.toFixed(2),
        actualOrderValue: actualOrderValue.toFixed(2),
        maxPositionsPerPair: this.config.max_positions_per_pair,
        orderSource: 'Real Bybit Limit Order with Take Profit',
        configCompliance: 'PASSED_WITH_SLIPPAGE',
        orderStrategy: 'support_based_limit_with_take_profit',
        slippageUsed: ((actualOrderValue - configuredMaxOrderAmount) / configuredMaxOrderAmount * 100).toFixed(2) + '%'
      });

      // Mark signal as processed
      await supabase
        .from('trading_signals')
        .update({ processed: true })
        .eq('id', signal.id);

    } catch (error) {
      console.error(`Error executing buy order for ${symbol}:`, error);
      throw error;
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      // Valid log types based on database constraints
      const validLogTypes = [
        'signal_processed',
        'trade_executed',
        'trade_filled',
        'position_closed',
        'system_error',
        'order_placed',
        'order_failed',
        'calculation_error',
        'execution_error',
        'signal_rejected',
        'order_rejected'
      ];

      // Map invalid types to valid ones
      const typeMapping: Record<string, string> = {
        'manual_close': 'position_closed',
        'close_rejected': 'order_rejected',
        'close_error': 'execution_error',
        'trade_closed': 'position_closed'
      };

      const validType = typeMapping[type] || (validLogTypes.includes(type) ? type : 'system_error');

      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: validType,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
