
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { OrderFillChecker } from './orderFillChecker';

export class PositionMonitor {
  private userId: string;
  private bybitService: BybitService;
  private config: TradingConfigData;
  private orderFillChecker: OrderFillChecker;

  constructor(userId: string, bybitService: BybitService, config: TradingConfigData) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.config = config;
    this.orderFillChecker = new OrderFillChecker(userId, bybitService);
    
    console.log('PositionMonitor initialized with config:', {
      takeProfitPercent: this.config.take_profit_percent,
      entryOffsetPercent: this.config.entry_offset_percent,
      maxPositionsPerPair: this.config.max_positions_per_pair,
      maxOrderAmountUsd: this.config.max_order_amount_usd
    });
  }

  private formatQuantityForSymbol(symbol: string, quantity: number): string {
    // Stricter precision rules to avoid "too many decimals" errors
    const precisionRules: Record<string, number> = {
      'BTCUSDT': 5,    // BTC allows up to 5 decimals
      'ETHUSDT': 3,    // ETH allows up to 3 decimals  
      'BNBUSDT': 2,    // BNB allows up to 2 decimals
      'SOLUSDT': 1,    // SOL reduced to 1 decimal for safety
      'ADAUSDT': 0,    // ADA whole numbers only
      'XRPUSDT': 0,    // XRP whole numbers only
      'LTCUSDT': 3,    // LTC allows up to 3 decimals
      'DOGEUSDT': 0,   // DOGE whole numbers only
      'MATICUSDT': 0,  // MATIC whole numbers only
      'FETUSDT': 0,    // FET whole numbers only
      'POLUSDT': 0,    // POL whole numbers only - this was causing errors
      'XLMUSDT': 0,    // XLM whole numbers only
    };

    const decimals = precisionRules[symbol] || 0; // Default to 0 decimals for safety
    let formattedQty = quantity.toFixed(decimals);
    
    // Remove trailing zeros but ensure proper formatting
    if (decimals > 0) {
      formattedQty = parseFloat(formattedQty).toString();
    }
    
    console.log(`Formatting quantity for ${symbol}: ${quantity} -> ${formattedQty} (${decimals} decimals, strict mode)`);
    return formattedQty;
  }

  private validateMinOrderValue(symbol: string, quantity: number, price: number): boolean {
    const orderValue = quantity * price;
    
    // Conservative minimum order values
    const minOrderValues: Record<string, number> = {
      'BTCUSDT': 25,
      'ETHUSDT': 25,
      'BNBUSDT': 25,
      'SOLUSDT': 25,
      'LTCUSDT': 25,
      'ADAUSDT': 15,
      'XRPUSDT': 15,
      'DOGEUSDT': 15,
      'MATICUSDT': 15,
      'FETUSDT': 15,
      'POLUSDT': 15,
      'XLMUSDT': 15,
    };

    const minValue = minOrderValues[symbol] || 25;
    
    console.log(`Order value validation for ${symbol}: ${orderValue.toFixed(2)} USD (min: ${minValue})`);
    
    if (orderValue < minValue) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} below minimum ${minValue}`);
      return false;
    }
    
    return true;
  }

  private async checkAccountBalance(symbol: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking account balance for ${symbol}...`);
      
      const balanceData = await this.bybitService.getAccountBalance();
      
      if (balanceData.retCode === 0 && balanceData.result?.list?.[0]?.coin) {
        const coins = balanceData.result.list[0].coin;
        const baseSymbol = symbol.replace('USDT', ''); // e.g., 'BTC' from 'BTCUSDT'
        
        const coinBalance = coins.find((coin: any) => coin.coin === baseSymbol);
        
        if (coinBalance) {
          const availableBalance = parseFloat(coinBalance.walletBalance || '0');
          console.log(`💰 ${baseSymbol} balance: ${availableBalance}`);
          return availableBalance > 0;
        } else {
          console.log(`❌ No ${baseSymbol} balance found in account`);
          return false;
        }
      }
      
      console.log(`❌ Failed to get balance data from Bybit`);
      return false;
    } catch (error) {
      console.error(`Error checking account balance for ${symbol}:`, error);
      return false;
    }
  }

  async monitorPositions(): Promise<void> {
    console.log('🔍 Starting position monitoring...');
    console.log(`Using take profit percentage from config: ${this.config.take_profit_percent}%`);
    console.log(`Max order amount from config: $${this.config.max_order_amount_usd}`);
    
    try {
      // Check and fill any pending orders first
      console.log('🔄 Checking pending orders for fill conditions...');
      await this.orderFillChecker.checkAndFillPendingOrders();

      // Then monitor filled positions for take profit
      const { data: filledTrades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'filled');

      if (!filledTrades || filledTrades.length === 0) {
        console.log('No filled trades to monitor for take profit');
        return;
      }

      console.log(`Monitoring ${filledTrades.length} filled trades for take profit using config: ${this.config.take_profit_percent}%...`);

      for (const trade of filledTrades) {
        await this.checkTradeForClosure(trade);
      }
    } catch (error) {
      console.error('Error in position monitoring:', error);
      await this.logActivity('system_error', 'Position monitoring failed', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async checkTradeForClosure(trade: any): Promise<void> {
    try {
      console.log(`\n📊 Checking trade ${trade.id} for ${trade.symbol}:`);
      console.log(`  Entry Price: $${trade.price}`);
      console.log(`  Side: ${trade.side}`);
      console.log(`  Status: ${trade.status}`);
      console.log(`  Quantity: ${trade.quantity}`);
      console.log(`  Take Profit Target: ${this.config.take_profit_percent}%`);

      // Get fresh market price from Bybit
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      
      console.log(`  Current Price: $${currentPrice}`);

      // Calculate profit/loss percentage and dollar amount
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());

      let profitPercent = 0;
      let dollarProfitLoss = 0;

      if (trade.side === 'buy') {
        profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
        dollarProfitLoss = (currentPrice - entryPrice) * quantity;
      } else {
        profitPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
        dollarProfitLoss = (entryPrice - currentPrice) * quantity;
      }

      console.log(`  Profit/Loss: ${profitPercent.toFixed(2)}% ($${dollarProfitLoss.toFixed(2)})`);
      console.log(`  Take Profit Target from config: ${this.config.take_profit_percent}%`);

      // Update the trade with current P&L
      await this.updateTradeWithCurrentPL(trade.id, dollarProfitLoss);

      // Check if profit target is reached
      if (profitPercent >= this.config.take_profit_percent) {
        console.log(`🎯 PROFIT TARGET REACHED! Checking if we can close position for ${trade.symbol} (${profitPercent.toFixed(2)}% >= ${this.config.take_profit_percent}%)`);
        
        // Check account balance before attempting to close
        const hasBalance = await this.checkAccountBalance(trade.symbol);
        if (!hasBalance) {
          console.log(`❌ Insufficient balance to close ${trade.symbol} position - skipping closure`);
          await this.logActivity('execution_error', `Cannot close ${trade.symbol}: insufficient balance in account`, {
            tradeId: trade.id,
            symbol: trade.symbol,
            reason: 'insufficient_account_balance'
          });
          return;
        }
        
        await this.closePosition(trade, currentPrice, dollarProfitLoss);
      } else {
        console.log(`  📈 Position still under target (${profitPercent.toFixed(2)}% < ${this.config.take_profit_percent}%)`);
      }
    } catch (error) {
      console.error(`Error checking trade ${trade.id}:`, error);
      await this.logActivity('system_error', `Failed to check trade ${trade.id}`, { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        tradeId: trade.id,
        symbol: trade.symbol 
      });
    }
  }

  private async updateTradeWithCurrentPL(tradeId: string, dollarProfitLoss: number): Promise<void> {
    try {
      await supabase
        .from('trades')
        .update({
          profit_loss: dollarProfitLoss,
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId);
    } catch (error) {
      console.error('Error updating trade P&L:', error);
    }
  }

  private async closePosition(trade: any, currentPrice: number, dollarProfitLoss: number): Promise<void> {
    try {
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());
      const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      
      console.log(`💰 Attempting to close position for ${trade.symbol}:`);
      console.log(`  Entry: $${entryPrice}`);
      console.log(`  Exit: $${currentPrice}`);
      console.log(`  Quantity: ${quantity}`);
      console.log(`  Dollar P&L: $${dollarProfitLoss.toFixed(2)}`);
      console.log(`  Percent P&L: ${profitPercent.toFixed(2)}%`);

      // Check if trade is already closed
      const { data: currentTrade } = await supabase
        .from('trades')
        .select('status')
        .eq('id', trade.id)
        .single();

      if (currentTrade?.status === 'closed') {
        console.log(`Trade ${trade.id} is already closed, skipping`);
        return;
      }

      // Format quantity properly for close order - use stricter formatting
      const formattedQuantity = this.formatQuantityForSymbol(trade.symbol, quantity);
      
      // Validate minimum order value before placing sell order
      if (!this.validateMinOrderValue(trade.symbol, parseFloat(formattedQuantity), currentPrice)) {
        console.log(`❌ Cannot close ${trade.symbol}: order value below minimum`);
        await this.logActivity('order_rejected', `Cannot close ${trade.symbol}: order value below minimum`, {
          tradeId: trade.id,
          quantity: formattedQuantity,
          currentPrice,
          orderValue: parseFloat(formattedQuantity) * currentPrice,
          reason: 'order_value_too_low'
        });
        return;
      }

      let closeOrderId = null;
      let closeSuccessful = false;

      try {
        console.log(`🔄 Placing sell order on Bybit for ${trade.symbol} with quantity: ${formattedQuantity}`);
        
        // Place sell order on Bybit
        const sellOrder = await this.bybitService.placeOrder({
          category: 'spot',
          symbol: trade.symbol,
          side: 'Sell',
          orderType: 'Market',
          qty: formattedQuantity,
        });

        console.log('Sell order response:', sellOrder);

        if (sellOrder.retCode === 0 && sellOrder.result?.orderId) {
          closeOrderId = sellOrder.result.orderId;
          closeSuccessful = true;
          
          console.log(`✅ Sell order placed successfully: ${closeOrderId}`);
        } else {
          console.error(`Failed to place sell order for ${trade.symbol}:`, sellOrder);
          await this.logActivity('execution_error', `Failed to place sell order for ${trade.symbol}`, { 
            sellOrder,
            reason: `Bybit error: ${sellOrder.retMsg}`,
            retCode: sellOrder.retCode,
            tradeId: trade.id,
            formattedQuantity
          });
          return;
        }
      } catch (orderError) {
        console.error(`Error placing close order for ${trade.symbol}:`, orderError);
        await this.logActivity('execution_error', `Error placing close order for ${trade.symbol}`, { 
          error: orderError instanceof Error ? orderError.message : 'Unknown error',
          tradeId: trade.id,
          symbol: trade.symbol,
          formattedQuantity
        });
        return;
      }

      // Only update database if Bybit order was successful
      if (closeSuccessful) {
        const { error } = await supabase
          .from('trades')
          .update({
            status: 'closed',
            profit_loss: dollarProfitLoss,
            updated_at: new Date().toISOString()
          })
          .eq('id', trade.id)
          .eq('status', 'filled'); // Only update if still filled

        if (error) {
          console.error(`Database error closing position:`, error);
          throw error;
        }

        console.log(`✅ Position closed successfully for ${trade.symbol}`);
        
        await this.logActivity('position_closed', `Position closed for ${trade.symbol} with ${profitPercent.toFixed(2)}% profit`, {
          symbol: trade.symbol,
          entryPrice,
          exitPrice: currentPrice,
          quantity: formattedQuantity,
          dollarProfitLoss,
          profitPercent,
          takeProfitTarget: this.config.take_profit_percent,
          tradeId: trade.id,
          sellOrderId: closeOrderId
        });
      }

    } catch (error) {
      console.error(`Error closing position for ${trade.symbol}:`, error);
      await this.logActivity('execution_error', `Failed to close position for ${trade.symbol}`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        tradeId: trade.id,
        symbol: trade.symbol 
      });
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
