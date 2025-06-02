
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { PositionChecker } from './positionChecker';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradeSyncService } from './tradeSyncService';

export class SignalExecutionService {
  private userId: string;
  private bybitService: BybitService;
  private positionChecker: PositionChecker;
  private config: TradingConfigData;
  private tradeSyncService: TradeSyncService;

  constructor(userId: string, config: TradingConfigData, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.positionChecker = new PositionChecker(userId);
    this.config = config;
    this.tradeSyncService = new TradeSyncService(userId, bybitService);
    
    console.log('SignalExecutionService config validation:', {
      entryOffset: this.config.entry_offset_percent,
      takeProfit: this.config.take_profit_percent,
      maxOrderAmount: this.config.max_order_amount_usd,
      maxPositionsPerPair: this.config.max_positions_per_pair,
      newSupportThreshold: this.config.new_support_threshold_percent
    });
  }

  private formatQuantityForSymbol(symbol: string, quantity: number): string {
    // Updated precision rules for Bybit demo trading
    const precisionRules: Record<string, number> = {
      // Major pairs - more conservative precision
      'BTCUSDT': 5,
      'ETHUSDT': 3,
      'BNBUSDT': 2,
      'SOLUSDT': 2,  // Reduced from 3 to 2
      'ADAUSDT': 0,
      'XRPUSDT': 0,
      'DOGEUSDT': 0,
      'MATICUSDT': 0,
      'LTCUSDT': 3,
      // Lower value coins
      'FETUSDT': 0,
      'POLUSDT': 0,  // Reduced from 3 to 0
      'XLMUSDT': 0,
    };

    const decimals = precisionRules[symbol] || 2; // Default to 2 decimal places
    let formattedQty = quantity.toFixed(decimals);
    
    // Remove trailing zeros but ensure proper formatting
    if (decimals > 0) {
      formattedQty = parseFloat(formattedQty).toString();
    }
    
    console.log(`Formatting quantity for ${symbol}: ${quantity} -> ${formattedQty} (${decimals} decimals)`);
    return formattedQty;
  }

  private validateOrderValue(symbol: string, quantity: number, price: number): boolean {
    const orderValue = quantity * price;
    
    // Increased minimum order values for demo trading
    const minOrderValues: Record<string, number> = {
      'BTCUSDT': 20,
      'ETHUSDT': 20,
      'BNBUSDT': 20,
      'SOLUSDT': 20,
      'LTCUSDT': 20,
      'ADAUSDT': 10,
      'XRPUSDT': 10,
      'DOGEUSDT': 10,
      'MATICUSDT': 10,
      'FETUSDT': 10,
      'POLUSDT': 10,
      'XLMUSDT': 10,
    };

    const minValue = minOrderValues[symbol] || 20; // Increased default to $20
    
    console.log(`Order value validation for ${symbol}: ${orderValue.toFixed(2)} USD (min: ${minValue})`);
    
    if (orderValue < minValue) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} below minimum ${minValue}`);
      return false;
    }
    
    return true;
  }

  async executeSignal(signal: any): Promise<void> {
    console.log(`\n🎯 Processing signal for ${signal.symbol}:`);
    console.log(`  Signal Type: ${signal.signal_type}`);
    console.log(`  Price: $${signal.price}`);
    console.log(`  Confidence: ${signal.confidence}%`);
    console.log(`  Using config: Entry Offset ${this.config.entry_offset_percent}%, Take Profit ${this.config.take_profit_percent}%, Max Positions per Pair: ${this.config.max_positions_per_pair}`);

    try {
      // Only process buy signals
      if (signal.signal_type !== 'buy') {
        console.log(`❌ Skipping non-buy signal for ${signal.symbol}`);
        return;
      }

      // Use config values directly
      const entryOffsetPercent = this.config.entry_offset_percent;
      const takeProfitPercent = this.config.take_profit_percent;
      const maxOrderAmountUsd = this.config.max_order_amount_usd;
      const maxPositionsPerPair = this.config.max_positions_per_pair;
      const newSupportThresholdPercent = this.config.new_support_threshold_percent;
      const maxActivePairs = this.config.max_active_pairs;

      console.log(`  Validated config values - Entry: ${entryOffsetPercent}%, TP: ${takeProfitPercent}%, Max Order: $${maxOrderAmountUsd}`);

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

      // Get current market price to determine if we should place a market or limit order
      const marketData = await this.bybitService.getMarketPrice(signal.symbol);
      const currentMarketPrice = marketData.price;
      
      // Calculate entry price with offset using config value
      const entryPrice = signal.price * (1 + entryOffsetPercent / 100);
      console.log(`📈 Entry price calculated: $${entryPrice.toFixed(6)} (${entryOffsetPercent}% above support)`);
      console.log(`📊 Current market price: $${currentMarketPrice.toFixed(6)}`);

      // Calculate quantity based on max order amount from config
      const quantity = maxOrderAmountUsd / entryPrice;
      console.log(`📊 Order quantity: ${quantity.toFixed(6)} (based on $${maxOrderAmountUsd} max order)`);

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

      // Determine order type and execution price
      let orderType: 'market' | 'limit';
      let executionPrice: number;

      if (currentMarketPrice <= entryPrice) {
        // Market price is below or at our entry price, place market order for immediate fill
        orderType = 'market';
        executionPrice = currentMarketPrice;
        console.log(`💡 Market price (${currentMarketPrice.toFixed(6)}) <= entry price (${entryPrice.toFixed(6)}), placing MARKET order`);
      } else {
        // Market price is above our entry price, place limit order to wait for better price
        orderType = 'limit';
        executionPrice = entryPrice;
        console.log(`💡 Market price (${currentMarketPrice.toFixed(6)}) > entry price (${entryPrice.toFixed(6)}), placing LIMIT order`);
      }

      // Execute the trade
      await this.executeBuyOrder(signal.symbol, executionPrice, quantity, signal, takeProfitPercent, orderType);

    } catch (error) {
      console.error(`Error executing signal for ${signal.symbol}:`, error);
      await this.logActivity('execution_error', `Signal execution failed for ${signal.symbol}`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        signal: signal 
      });
    }
  }

  private async executeBuyOrder(symbol: string, price: number, quantity: number, signal: any, takeProfitPercent: number, orderType: 'market' | 'limit'): Promise<void> {
    try {
      console.log(`\n💰 Executing ${orderType.toUpperCase()} buy order for ${symbol}:`);
      console.log(`  Price: $${price.toFixed(6)}`);
      console.log(`  Quantity: ${quantity.toFixed(6)}`);
      console.log(`  Total Value: $${(price * quantity).toFixed(2)}`);
      console.log(`  Take Profit Target: ${takeProfitPercent}%`);

      // Validate inputs before order placement
      if (isNaN(price) || isNaN(quantity) || price <= 0 || quantity <= 0) {
        throw new Error(`Invalid trade parameters: price=${price}, quantity=${quantity}`);
      }

      // Validate minimum order value
      if (!this.validateOrderValue(symbol, quantity, price)) {
        await this.logActivity('order_rejected', `Order rejected for ${symbol}: value below minimum`, {
          symbol,
          quantity,
          price,
          orderValue: quantity * price,
          reason: 'order_value_too_low'
        });
        return;
      }

      let bybitOrderId = null;
      let tradeStatus: 'pending' | 'filled' = 'pending';
      let actualFillPrice = price;

      // Try to place real order on Bybit Demo
      try {
        console.log(`🔄 Placing ${orderType.toUpperCase()} order on Bybit Demo for ${symbol}...`);
        
        // Format quantity with proper precision for the symbol
        const formattedQuantity = this.formatQuantityForSymbol(symbol, quantity);
        const formattedPrice = orderType === 'limit' ? price.toFixed(2) : undefined;
        
        console.log(`  Formatted quantity: ${formattedQuantity}`);
        if (formattedPrice) console.log(`  Formatted price: ${formattedPrice}`);

        // Place buy order on Bybit Demo
        const orderParams = {
          category: 'spot' as const,
          symbol: symbol,
          side: 'Buy' as const,
          orderType: orderType === 'market' ? 'Market' as const : 'Limit' as const,
          qty: formattedQuantity,
          ...(orderType === 'limit' && formattedPrice ? { price: formattedPrice } : {}),
          timeInForce: orderType === 'market' ? 'IOC' as const : 'GTC' as const
        };

        console.log('Sending order request to Bybit:', orderParams);

        const orderResult = await this.bybitService.placeOrder(orderParams);
        console.log('Bybit order response:', orderResult);

        if (orderResult && orderResult.retCode === 0 && orderResult.result?.orderId) {
          bybitOrderId = orderResult.result.orderId;
          
          // For market orders, they should be filled immediately
          if (orderType === 'market') {
            tradeStatus = 'filled';
            // Use the actual execution price from Bybit if available
            if (orderResult.result.price && !isNaN(parseFloat(orderResult.result.price))) {
              actualFillPrice = parseFloat(orderResult.result.price);
            } else {
              // Fallback to current market price for market orders
              const currentMarketData = await this.bybitService.getMarketPrice(symbol);
              actualFillPrice = currentMarketData.price;
            }
          }
          
          console.log(`✅ Successfully placed ${orderType.toUpperCase()} order on Bybit Demo: ${bybitOrderId}`);
          console.log(`  Order status: ${tradeStatus}`);
          console.log(`  Fill price: $${actualFillPrice.toFixed(6)}`);
          
          await this.logActivity('order_placed', `Real ${orderType} order placed successfully on Bybit Demo for ${symbol}`, {
            bybitOrderId,
            orderResult,
            symbol,
            quantity: formattedQuantity,
            price: actualFillPrice,
            orderType: `${orderType} Buy`,
            status: tradeStatus
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
        console.error(`❌ Failed to place order on Bybit Demo: ${bybitError instanceof Error ? bybitError.message : 'Unknown error'}`);
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
          order_type: orderType,
          price: actualFillPrice,
          quantity: parseFloat(this.formatQuantityForSymbol(symbol, quantity)),
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
      console.log(`  Order Type: ${orderType.toUpperCase()}`);
      console.log(`  Actual Fill Price: $${actualFillPrice.toFixed(6)}`);
      console.log(`  Config used - Take Profit: ${takeProfitPercent}%, Max Order: $${this.config.max_order_amount_usd}`);

      await this.logActivity('trade_executed', `${orderType.toUpperCase()} buy order executed successfully for ${symbol} on Bybit Demo`, {
        symbol,
        price: actualFillPrice,
        quantity: parseFloat(this.formatQuantityForSymbol(symbol, quantity)),
        totalValue: actualFillPrice * parseFloat(this.formatQuantityForSymbol(symbol, quantity)),
        tradeId: trade.id,
        bybitOrderId,
        orderType,
        status: tradeStatus,
        takeProfitTarget: takeProfitPercent,
        entryOffset: this.config.entry_offset_percent,
        maxOrderAmount: this.config.max_order_amount_usd,
        maxPositionsPerPair: this.config.max_positions_per_pair,
        orderSource: 'Real Bybit Demo Order'
      });

      // Mark signal as processed
      await supabase
        .from('trading_signals')
        .update({ processed: true })
        .eq('id', signal.id);

      // Start verification process for the new trade if we have a real Bybit order ID
      if (bybitOrderId && !bybitOrderId.startsWith('mock_')) {
        console.log(`🔍 Starting order verification for trade ${trade.id}...`);
        
        // Verify order placement after a short delay
        setTimeout(async () => {
          await this.tradeSyncService.verifyOrderPlacement(trade.id);
        }, 3000);
      }

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
