
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { PositionChecker } from './positionChecker';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

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

      let bybitOrderId = `mock_${Date.now()}`;
      let tradeStatus: 'pending' | 'filled' = orderType === 'market' ? 'filled' : 'pending';

      // Try to place actual order on Bybit Demo if service is available
      try {
        console.log(`🔄 Attempting to place ${orderType.toUpperCase()} order on Bybit Demo for ${symbol}...`);
        
        // Place buy order on Bybit Demo
        const orderParams = {
          category: 'spot' as const,
          symbol: symbol,
          side: 'Buy' as const,
          orderType: orderType === 'market' ? 'Market' as const : 'Limit' as const,
          qty: quantity.toString(),
          ...(orderType === 'limit' ? { price: price.toString() } : {}),
          timeInForce: orderType === 'market' ? 'IOC' as const : 'GTC' as const
        };

        const orderResult = await this.bybitService.placeOrder(orderParams);

        if (orderResult && orderResult.orderId) {
          bybitOrderId = orderResult.orderId;
          console.log(`✅ Successfully placed ${orderType.toUpperCase()} order on Bybit Demo: ${bybitOrderId}`);
          await this.logActivity('trade_created', `Real ${orderType} order placed on Bybit Demo for ${symbol}`, {
            bybitOrderId,
            orderResult,
            symbol,
            quantity,
            orderType: `${orderType} Buy`
          });
        } else {
          console.log(`⚠️ Bybit order placement returned no order ID, using mock order`);
          await this.logActivity('trade_created', `Bybit order placement failed, using mock order for ${symbol}`, {
            orderResult,
            symbol,
            fallbackToMock: true
          });
        }
      } catch (bybitError) {
        console.error(`⚠️ Failed to place order on Bybit Demo: ${bybitError instanceof Error ? bybitError.message : 'Unknown error'}`);
        console.log(`📝 Falling back to mock order for tracking purposes`);
        await this.logActivity('trade_created', `Bybit order failed, using mock order for ${symbol}`, {
          bybitError: bybitError instanceof Error ? bybitError.message : 'Unknown error',
          symbol,
          fallbackToMock: true
        });
      }

      // Create trade record in database
      const { data: trade, error } = await supabase
        .from('trades')
        .insert({
          user_id: this.userId,
          symbol,
          side: 'buy',
          order_type: orderType,
          price: price,
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
      console.log(`  Order Type: ${orderType.toUpperCase()}`);
      console.log(`  Config used - Take Profit: ${takeProfitPercent}%, Max Order: $${this.config.max_order_amount_usd}`);

      await this.logActivity('trade_created', `${orderType.toUpperCase()} buy order executed for ${symbol} (Order ID: ${bybitOrderId})`, {
        symbol,
        price,
        quantity,
        totalValue: price * quantity,
        tradeId: trade.id,
        bybitOrderId,
        orderType,
        status: tradeStatus,
        takeProfitTarget: takeProfitPercent,
        entryOffset: this.config.entry_offset_percent,
        maxOrderAmount: this.config.max_order_amount_usd,
        maxPositionsPerPair: this.config.max_positions_per_pair,
        orderSource: bybitOrderId.startsWith('mock_') ? 'Mock Order' : 'Real Bybit Order'
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
