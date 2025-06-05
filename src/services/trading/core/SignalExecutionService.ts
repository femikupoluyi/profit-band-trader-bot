
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfig } from '../config/TradingConfigManager';

export class SignalExecutionService {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
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

  private formatQuantityForSymbol(symbol: string, quantity: number): string {
    // Quantity precision rules for different symbols - more conservative to avoid decimal errors
    const quantityPrecisionRules: Record<string, number> = {
      'BTCUSDT': 5,    // BTC allows up to 5 decimals
      'ETHUSDT': 3,    // ETH allows up to 3 decimals  
      'BNBUSDT': 2,    // BNB allows up to 2 decimals
      'SOLUSDT': 1,    // SOL reduced to 1 decimal for safety
      'ADAUSDT': 0,    // ADA whole numbers only
      'XRPUSDT': 1,    // XRP 1 decimal place
      'LTCUSDT': 2,    // LTC allows up to 2 decimals
      'DOGEUSDT': 0,   // DOGE whole numbers only
      'MATICUSDT': 0,  // MATIC whole numbers only
      'FETUSDT': 0,    // FET whole numbers only
      'POLUSDT': 0,    // POL whole numbers only
      'XLMUSDT': 0,    // XLM whole numbers only
    };

    const decimals = quantityPrecisionRules[symbol] || 0; // Default to 0 decimals for safety
    let formattedQty = quantity.toFixed(decimals);
    
    // Remove trailing zeros but ensure proper formatting
    if (decimals > 0) {
      formattedQty = parseFloat(formattedQty).toString();
    }
    
    console.log(`Formatting quantity for ${symbol}: ${quantity} -> ${formattedQty} (${decimals} decimals)`);
    return formattedQty;
  }

  async executeSignals(config: TradingConfig): Promise<void> {
    try {
      console.log('⚡ Executing unprocessed signals...');

      const { data: signals, error } = await supabase
        .from('trading_signals')
        .select('*')
        .eq('user_id', this.userId)
        .eq('processed', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!signals || signals.length === 0) {
        console.log('📭 No unprocessed signals found');
        return;
      }

      console.log(`📊 Processing ${signals.length} signals`);

      for (const signal of signals) {
        await this.executeSignal(signal, config);
      }

      console.log('✅ Signal execution completed');
    } catch (error) {
      console.error('❌ Error executing signals:', error);
      throw error;
    }
  }

  private async executeSignal(signal: any, config: TradingConfig): Promise<void> {
    try {
      console.log(`\n⚡ Executing signal for ${signal.symbol}:`);
      
      // ENHANCED: Check position limits BEFORE executing signal
      const canExecute = await this.validatePositionLimits(signal.symbol, config);
      if (!canExecute) {
        console.log(`❌ Position limits exceeded for ${signal.symbol}, rejecting signal`);
        await this.markSignalRejected(signal.id, 'Position limits exceeded');
        return;
      }
      
      const entryPrice = parseFloat(signal.price.toString());
      
      // 1. Calculate quantity with proper formatting
      const rawQuantity = config.maximum_order_amount_usd / entryPrice;
      const increment = config.quantity_increment_per_symbol[signal.symbol] || 0.0001;
      const adjustedQuantity = Math.floor(rawQuantity / increment) * increment;
      
      // Format quantity using symbol-specific precision rules
      const finalQuantity = parseFloat(this.formatQuantityForSymbol(signal.symbol, adjustedQuantity));
      
      console.log(`  Raw Quantity: ${rawQuantity.toFixed(6)}`);
      console.log(`  Adjusted Quantity: ${adjustedQuantity.toFixed(6)}`);
      console.log(`  Final Formatted Quantity: ${finalQuantity}`);
      
      // 2. Check minimum notional
      const orderValue = finalQuantity * entryPrice;
      const minNotional = config.minimum_notional_per_symbol[signal.symbol] || 10;
      
      if (orderValue < minNotional) {
        console.log(`❌ Order value ${orderValue.toFixed(2)} below minimum ${minNotional}`);
        await this.markSignalRejected(signal.id, 'below minimum notional');
        return;
      }

      // 3. Calculate take-profit price
      const takeProfitPrice = entryPrice * (1 + config.take_profit_percentage / 100);
      
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(4)} (+${config.take_profit_percentage}%)`);

      // 4. Place REAL limit buy order on Bybit - NO MOCK ORDERS
      await this.placeRealBybitOrder(signal, finalQuantity, entryPrice, takeProfitPrice, config);
      
    } catch (error) {
      console.error(`❌ Error executing signal ${signal.id}:`, error);
      await this.markSignalRejected(signal.id, error.message);
    }
  }

  private async validatePositionLimits(symbol: string, config: TradingConfig): Promise<boolean> {
    try {
      // Check max active pairs
      const { data: activePairs } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled', 'partial_filled']);

      const uniquePairs = new Set(activePairs?.map(trade => trade.symbol) || []);
      const activePairCount = uniquePairs.size;
      
      // If this symbol is new and we're at max pairs, reject
      if (!uniquePairs.has(symbol) && activePairCount >= config.maximum_active_pairs) {
        console.log(`❌ Max active pairs limit reached: ${activePairCount}/${config.maximum_active_pairs}`);
        return false;
      }

      // Check max positions per pair for this specific symbol
      const { count: currentPositions } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .in('status', ['pending', 'filled', 'partial_filled']);

      if ((currentPositions || 0) >= config.maximum_positions_per_pair) {
        console.log(`❌ Max positions per pair exceeded for ${symbol}: ${currentPositions}/${config.maximum_positions_per_pair}`);
        return false;
      }

      console.log(`✅ Position limits check passed for ${symbol}: ${currentPositions}/${config.maximum_positions_per_pair} positions, ${activePairCount}/${config.maximum_active_pairs} pairs`);
      return true;

    } catch (error) {
      console.error('Error validating position limits:', error);
      return false;
    }
  }

  private async placeRealBybitOrder(signal: any, quantity: number, entryPrice: number, takeProfitPrice: number, config: TradingConfig): Promise<void> {
    try {
      console.log(`🔄 Placing REAL limit buy order on Bybit for ${signal.symbol}:`);
      console.log(`  Quantity: ${quantity}`);
      console.log(`  Entry Price: $${entryPrice.toFixed(4)}`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(4)}`);
      
      // Format quantity and price with correct decimal precision for the symbol
      const formattedQuantity = this.formatQuantityForSymbol(signal.symbol, quantity);
      const formattedEntryPrice = this.formatPriceForSymbol(signal.symbol, entryPrice);

      console.log(`  🔧 Formatted Quantity: ${formattedQuantity}`);
      console.log(`  🔧 Formatted Entry Price: ${formattedEntryPrice}`);

      // ALWAYS place real Bybit order - no fallback to mock
      const buyOrderParams = {
        category: 'spot' as const,
        symbol: signal.symbol,
        side: 'Buy' as const,
        orderType: 'Limit' as const,
        qty: formattedQuantity,
        price: formattedEntryPrice,
        timeInForce: 'GTC' as const
      };

      console.log('📝 Placing REAL BUY order with formatted values:', buyOrderParams);
      const buyOrderResult = await this.bybitService.placeOrder(buyOrderParams);

      if (buyOrderResult && buyOrderResult.retCode === 0 && buyOrderResult.result?.orderId) {
        const bybitOrderId = buyOrderResult.result.orderId;
        console.log(`✅ REAL Bybit BUY order placed successfully: ${bybitOrderId}`);

        // Create trade record ONLY after successful Bybit order placement
        const { data: trade, error } = await supabase
          .from('trades')
          .insert({
            user_id: this.userId,
            symbol: signal.symbol,
            side: 'buy',
            order_type: 'limit',
            price: entryPrice,
            quantity: parseFloat(formattedQuantity), // Use the formatted quantity value
            status: 'pending', // Real orders start as pending until Bybit confirms fill
            bybit_order_id: bybitOrderId,
          })
          .select()
          .single();

        if (error) throw error;

        // Mark signal as processed
        await supabase
          .from('trading_signals')
          .update({ processed: true })
          .eq('id', signal.id);

        console.log(`✅ Trade record created for REAL Bybit order ${bybitOrderId}`);
        
        await this.logActivity('order_placed', `REAL limit buy order placed on Bybit for ${signal.symbol}`, {
          symbol: signal.symbol,
          quantity: formattedQuantity,
          entryPrice: entryPrice,
          formattedPrice: formattedEntryPrice,
          takeProfitPrice: takeProfitPrice,
          orderValue: parseFloat(formattedQuantity) * entryPrice,
          bybitOrderId,
          tradeId: trade.id,
          orderType: 'REAL_BYBIT_LIMIT_ORDER'
        });

        // Place take-profit limit sell order after successful buy order
        await this.placeTakeProfitOrder(signal.symbol, parseFloat(formattedQuantity), takeProfitPrice);

      } else {
        console.error(`❌ Bybit order FAILED - retCode: ${buyOrderResult?.retCode}, retMsg: ${buyOrderResult?.retMsg}`);
        await this.markSignalRejected(signal.id, `Bybit order failed: ${buyOrderResult?.retMsg || 'Unknown error'}`);
        
        // Log the failure
        await this.logActivity('order_failed', `Bybit order failed for ${signal.symbol}`, {
          symbol: signal.symbol,
          error: buyOrderResult?.retMsg || 'Unknown error',
          retCode: buyOrderResult?.retCode,
          formattedPrice: formattedEntryPrice,
          originalPrice: entryPrice,
          formattedQuantity: formattedQuantity,
          originalQuantity: quantity
        });
      }

    } catch (error) {
      console.error(`❌ Error placing REAL order for ${signal.symbol}:`, error);
      await this.markSignalRejected(signal.id, `Order placement error: ${error.message}`);
      throw error;
    }
  }

  private async placeTakeProfitOrder(symbol: string, quantity: number, takeProfitPrice: number): Promise<void> {
    try {
      console.log(`🎯 Placing take-profit limit sell order for ${symbol}`);
      
      // Format take-profit price and quantity with correct decimal precision
      const formattedTakeProfitPrice = this.formatPriceForSymbol(symbol, takeProfitPrice);
      const formattedQuantity = this.formatQuantityForSymbol(symbol, quantity);
      
      console.log(`  🔧 Formatted Take-Profit Price: ${formattedTakeProfitPrice}`);
      console.log(`  🔧 Formatted Quantity: ${formattedQuantity}`);
      
      const sellOrderParams = {
        category: 'spot' as const,
        symbol: symbol,
        side: 'Sell' as const,
        orderType: 'Limit' as const,
        qty: formattedQuantity,
        price: formattedTakeProfitPrice,
        timeInForce: 'GTC' as const
      };

      console.log('📝 Placing take-profit SELL order with formatted values:', sellOrderParams);
      const sellOrderResult = await this.bybitService.placeOrder(sellOrderParams);
      
      if (sellOrderResult && sellOrderResult.retCode === 0) {
        console.log(`✅ Take-profit order placed: ${sellOrderResult.result?.orderId}`);
        
        await this.logActivity('order_placed', `Take-profit limit sell order placed for ${symbol}`, {
          symbol,
          quantity: formattedQuantity,
          takeProfitPrice,
          formattedPrice: formattedTakeProfitPrice,
          bybitOrderId: sellOrderResult.result?.orderId,
          orderType: 'TAKE_PROFIT_LIMIT_SELL'
        });
      } else {
        console.log(`⚠️ Take-profit order failed: ${sellOrderResult?.retMsg}`);
        
        await this.logActivity('order_failed', `Take-profit order failed for ${symbol}`, {
          symbol,
          error: sellOrderResult?.retMsg || 'Unknown error',
          formattedPrice: formattedTakeProfitPrice,
          originalPrice: takeProfitPrice,
          formattedQuantity: formattedQuantity
        });
      }
    } catch (error) {
      console.error(`❌ Error placing take-profit order for ${symbol}:`, error);
    }
  }

  private async markSignalRejected(signalId: string, reason: string): Promise<void> {
    try {
      await supabase
        .from('trading_signals')
        .update({ processed: true })
        .eq('id', signalId);

      await this.logActivity('signal_rejected', `Signal rejected: ${reason}`, {
        signalId,
        reason
      });
    } catch (error) {
      console.error('Error marking signal as rejected:', error);
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: type,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
