import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { OrderFillChecker } from './orderFillChecker';
import { TradeCloser } from './tradeCloser';
import { AccountBalanceChecker } from './accountBalanceChecker';

export class PositionMonitor {
  private userId: string;
  private bybitService: BybitService;
  private config: TradingConfigData;
  private orderFillChecker: OrderFillChecker;
  private tradeCloser: TradeCloser;
  private balanceChecker: AccountBalanceChecker;

  constructor(userId: string, bybitService: BybitService, config: TradingConfigData) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.config = config;
    this.orderFillChecker = new OrderFillChecker(userId, bybitService);
    this.tradeCloser = new TradeCloser(userId, bybitService, config);
    this.balanceChecker = new AccountBalanceChecker(bybitService);
    
    console.log('PositionMonitor initialized with config:', {
      takeProfitPercent: this.config.take_profit_percent,
      entryOffsetPercent: this.config.entry_offset_percent,
      maxPositionsPerPair: this.config.max_positions_per_pair,
      maxOrderAmountUsd: this.config.max_order_amount_usd
    });
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
        const hasBalance = await this.balanceChecker.checkAccountBalance(trade.symbol);
        if (!hasBalance) {
          console.log(`❌ Insufficient balance to close ${trade.symbol} position - skipping closure`);
          await this.logActivity('execution_error', `Cannot close ${trade.symbol}: insufficient balance in account`, {
            tradeId: trade.id,
            symbol: trade.symbol,
            reason: 'insufficient_account_balance'
          });
          return;
        }
        
        await this.tradeCloser.closePosition(trade, currentPrice, dollarProfitLoss);
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
