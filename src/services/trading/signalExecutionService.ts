
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
    
    // Validate config on construction
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

      // Validate config values and provide defaults if needed
      const entryOffsetPercent = this.config.entry_offset_percent || 1.0;
      const takeProfitPercent = this.config.take_profit_percent || 2.0;
      const maxOrderAmountUsd = this.config.max_order_amount_usd || 100.0;
      const maxPositionsPerPair = this.config.max_positions_per_pair || 2;
      const newSupportThresholdPercent = this.config.new_support_threshold_percent || 2.0;
      const maxActivePairs = this.config.max_active_pairs || 5;

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

      // Calculate entry price with offset using config value
      const entryPrice = signal.price * (1 + entryOffsetPercent / 100);
      console.log(`📈 Entry price calculated: $${entryPrice.toFixed(6)} (${entryOffsetPercent}% above support)`);

      // Calculate quantity based on max order amount from config
      const quantity = maxOrderAmountUsd / entryPrice;
      console.log(`📊 Order quantity: ${quantity.toFixed(6)} (based on $${maxOrderAmountUsd} max order)`);

      // Validate calculation results
      if (isNaN(entryPrice) || isNaN(quantity) || quantity <= 0 || entryPrice <= 0) {
        console.error(`❌ Invalid calculation results: entryPrice=${entryPrice}, quantity=${quantity}`);
        await this.logActivity('error', `Invalid calculation for ${signal.symbol}`, {
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

      // Execute the trade
      await this.executeBuyOrder(signal.symbol, entryPrice, quantity, signal, takeProfitPercent);

    } catch (error) {
      console.error(`Error executing signal for ${signal.symbol}:`, error);
      await this.logActivity('error', `Signal execution failed for ${signal.symbol}`, { 
        error: error.message,
        signal: signal 
      });
    }
  }

  private async executeBuyOrder(symbol: string, price: number, quantity: number, signal: any, takeProfitPercent: number): Promise<void> {
    try {
      console.log(`\n💰 Executing buy order for ${symbol}:`);
      console.log(`  Price: $${price.toFixed(6)}`);
      console.log(`  Quantity: ${quantity.toFixed(6)}`);
      console.log(`  Total Value: $${(price * quantity).toFixed(2)}`);
      console.log(`  Take Profit Target: ${takeProfitPercent}%`);

      // Validate inputs before database insert
      if (isNaN(price) || isNaN(quantity) || price <= 0 || quantity <= 0) {
        throw new Error(`Invalid trade parameters: price=${price}, quantity=${quantity}`);
      }

      // For now, create a mock trade record (replace with actual Bybit API call when ready)
      // Using 'filled' status which should be allowed by the constraint
      const { data: trade, error } = await supabase
        .from('trades')
        .insert({
          user_id: this.userId,
          symbol,
          side: 'buy',
          order_type: 'limit',
          price: price,
          quantity: quantity,
          status: 'filled', // This should be a valid status according to constraint
          bybit_order_id: `mock_${Date.now()}`, // Replace with actual order ID
        })
        .select()
        .single();

      if (error) {
        console.error('Database error inserting trade:', error);
        throw error;
      }

      console.log(`✅ Buy order executed successfully for ${symbol}`);
      console.log(`  Trade ID: ${trade.id}`);
      console.log(`  Config used - Take Profit: ${takeProfitPercent}%, Max Order: $${this.config.max_order_amount_usd}`);

      await this.logActivity('trade_executed', `Buy order executed for ${symbol}`, {
        symbol,
        price,
        quantity,
        totalValue: price * quantity,
        tradeId: trade.id,
        takeProfitTarget: takeProfitPercent,
        entryOffset: this.config.entry_offset_percent,
        maxOrderAmount: this.config.max_order_amount_usd,
        maxPositionsPerPair: this.config.max_positions_per_pair
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
