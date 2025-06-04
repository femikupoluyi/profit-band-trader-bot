
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

      // Use config values directly and enforce them strictly
      const entryOffsetPercent = this.config.entry_offset_percent;
      const takeProfitPercent = this.config.take_profit_percent;
      const maxOrderAmountUsd = this.config.max_order_amount_usd; // STRICT ENFORCEMENT
      const maxPositionsPerPair = this.config.max_positions_per_pair;
      const newSupportThresholdPercent = this.config.new_support_threshold_percent;
      const maxActivePairs = this.config.max_active_pairs;

      console.log(`  🔒 ENFORCING CONFIG VALUES - Entry: ${entryOffsetPercent}%, TP: ${takeProfitPercent}%, MAX ORDER: $${maxOrderAmountUsd} (STRICT)`);

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

      // Check if we can open a new position for this pair using config values
      const canOpenNewPosition = await this.positionChecker.canOpenNewPositionWithLowerSupport(
        signal.symbol,
        signal.price,
        newSupportThresholdPercent,
        maxPositionsPerPair
      );

      if (!canOpenNewPosition) {
        console.log(`❌ Cannot open new position for ${signal.symbol}: position limits reached or support threshold not met`);
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

      // Calculate entry price with offset using config value (support-based entry)
      const entryPrice = signal.price * (1 + entryOffsetPercent / 100);
      console.log(`📈 Support-based entry price calculated: $${entryPrice.toFixed(6)} (${entryOffsetPercent}% above support)`);

      // 🔒 STRICT ENFORCEMENT: Calculate quantity based on EXACT max order amount from config
      const quantity = maxOrderAmountUsd / entryPrice;
      const actualOrderValue = quantity * entryPrice;
      
      console.log(`📊 Order quantity: ${quantity.toFixed(6)} (based on STRICT $${maxOrderAmountUsd} max order)`);
      console.log(`💰 Actual order value: $${actualOrderValue.toFixed(2)} (should be ≤ $${maxOrderAmountUsd})`);

      // ENFORCE: Order value must not exceed config maximum - BEFORE any formatting
      if (actualOrderValue > maxOrderAmountUsd * 1.001) { // Allow tiny rounding tolerance
        console.error(`❌ CONFIGURATION VIOLATION: Order value $${actualOrderValue.toFixed(2)} exceeds configured maximum $${maxOrderAmountUsd}`);
        await this.logActivity('order_rejected', `Order rejected for ${signal.symbol}: exceeds max order amount`, {
          symbol: signal.symbol,
          actualOrderValue: actualOrderValue.toFixed(2),
          configuredMaximum: maxOrderAmountUsd,
          reason: 'exceeds_max_order_amount'
        });
        return;
      }

      // Format quantity for Bybit precision requirements
      const formattedQuantity = TradeValidation.getFormattedQuantity(signal.symbol, quantity);
      const formattedOrderValue = parseFloat(formattedQuantity) * entryPrice;

      // Final validation after formatting - ensure we still comply with limits
      if (formattedOrderValue > maxOrderAmountUsd * 1.01) { // Allow small formatting tolerance
        console.error(`❌ POST-FORMATTING VIOLATION: Formatted order value $${formattedOrderValue.toFixed(2)} exceeds configured maximum $${maxOrderAmountUsd}`);
        await this.logActivity('order_rejected', `Order rejected for ${signal.symbol}: formatted quantity exceeds max order amount`, {
          symbol: signal.symbol,
          formattedOrderValue: formattedOrderValue.toFixed(2),
          configuredMaximum: maxOrderAmountUsd,
          originalQuantity: quantity,
          formattedQuantity,
          reason: 'formatted_quantity_exceeds_max'
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

      // 🔒 ALWAYS USE LIMIT ORDERS for support-based trading - never market orders
      console.log(`💡 Using LIMIT order for support-based entry at $${entryPrice.toFixed(6)} (configured strategy)`);

      // Execute the trade with strict config enforcement - ALWAYS LIMIT ORDER
      await this.executeBuyOrder(signal.symbol, entryPrice, parseFloat(formattedQuantity), signal, takeProfitPercent, 'limit', maxOrderAmountUsd);

    } catch (error) {
      console.error(`Error executing signal for ${signal.symbol}:`, error);
      await this.logActivity('execution_error', `Signal execution failed for ${signal.symbol}`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        signal: signal 
      });
    }
  }

  private async executeBuyOrder(symbol: string, price: number, quantity: number, signal: any, takeProfitPercent: number, orderType: 'limit', configuredMaxOrderAmount: number): Promise<void> {
    try {
      const actualOrderValue = quantity * price;
      
      console.log(`\n💰 Executing LIMIT buy order for ${symbol}:`);
      console.log(`  Price: $${price.toFixed(6)}`);
      console.log(`  Quantity: ${quantity.toFixed(6)}`);
      console.log(`  Total Value: $${actualOrderValue.toFixed(2)}`);
      console.log(`  🔒 Configured Max: $${configuredMaxOrderAmount}`);
      console.log(`  ✅ Within Limit: ${actualOrderValue <= configuredMaxOrderAmount ? 'YES' : 'NO'}`);
      console.log(`  Take Profit Target: ${takeProfitPercent}%`);

      // Final validation - triple check order value doesn't exceed config
      if (actualOrderValue > configuredMaxOrderAmount) {
        throw new Error(`Order value $${actualOrderValue.toFixed(2)} exceeds configured maximum $${configuredMaxOrderAmount}`);
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
        console.log(`🔄 Placing LIMIT order on Bybit for ${symbol}...`);
        
        const formattedQuantity = quantity.toString();
        const formattedPrice = price.toFixed(2);
        
        console.log(`  Formatted quantity: ${formattedQuantity}`);
        console.log(`  Formatted price: ${formattedPrice}`);

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
          
          await this.logActivity('order_placed', `LIMIT order placed successfully on Bybit for ${symbol} within config limits`, {
            bybitOrderId,
            orderResult,
            symbol,
            quantity: formattedQuantity,
            price: actualFillPrice,
            orderType: 'Limit Buy',
            status: tradeStatus,
            configuredMaxOrderAmount,
            actualOrderValue: actualOrderValue.toFixed(2),
            orderStrategy: 'support_based_limit'
          });
        } else {
          console.error(`❌ Bybit order failed - retCode: ${orderResult?.retCode}, retMsg: ${orderResult?.retMsg}`);
          await this.logActivity('order_failed', `Bybit order failed for ${symbol}`, {
            orderResult,
            symbol,
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
      console.log(`  Order Type: LIMIT`);
      console.log(`  Entry Price: $${actualFillPrice.toFixed(6)}`);
      console.log(`  🔒 Config Compliance: Order value $${actualOrderValue.toFixed(2)} ≤ Max $${configuredMaxOrderAmount}`);

      await this.logActivity('trade_executed', `LIMIT buy order executed successfully for ${symbol} within config limits`, {
        symbol,
        price: actualFillPrice,
        quantity: quantity,
        totalValue: actualOrderValue,
        tradeId: trade.id,
        bybitOrderId,
        orderType: 'limit',
        status: tradeStatus,
        takeProfitTarget: takeProfitPercent,
        entryOffset: this.config.entry_offset_percent,
        configuredMaxOrderAmount,
        actualOrderValue: actualOrderValue.toFixed(2),
        maxPositionsPerPair: this.config.max_positions_per_pair,
        orderSource: 'Real Bybit Limit Order',
        configCompliance: 'PASSED',
        orderStrategy: 'support_based_limit'
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
