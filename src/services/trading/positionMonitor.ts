
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
      maxPositionsPerPair: this.config.max_positions_per_pair
    });
  }

  async monitorPositions(): Promise<void> {
    console.log('🔍 Starting position monitoring...');
    console.log(`Using take profit percentage from config: ${this.config.take_profit_percent}%`);
    
    try {
      // FIRST AND MOST IMPORTANT: Check and fill any pending orders that should be filled
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

      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      
      console.log(`  Current Price: $${currentPrice}`);

      // Calculate profit/loss percentage and dollar amount correctly
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());
      const originalInvestment = entryPrice * quantity;

      let profitPercent = 0;
      let dollarProfitLoss = 0;

      if (trade.side === 'buy') {
        profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
        dollarProfitLoss = (currentPrice - entryPrice) * quantity;
      } else {
        profitPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
        dollarProfitLoss = (entryPrice - currentPrice) * quantity;
      }

      console.log(`  Original Investment: $${originalInvestment.toFixed(2)}`);
      console.log(`  Profit/Loss: ${profitPercent.toFixed(2)}% ($${dollarProfitLoss.toFixed(2)})`);
      console.log(`  Take Profit Target from config: ${this.config.take_profit_percent}%`);

      // Update the trade with current P&L regardless of whether we close it
      await this.updateTradeWithCurrentPL(trade.id, dollarProfitLoss);

      // Check if profit target is reached using config value
      if (profitPercent >= this.config.take_profit_percent) {
        console.log(`🎯 PROFIT TARGET REACHED! Closing position for ${trade.symbol} (${profitPercent.toFixed(2)}% >= ${this.config.take_profit_percent}%)`);
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
      
      console.log(`💰 Closing position for ${trade.symbol}:`);
      console.log(`  Entry: $${entryPrice}`);
      console.log(`  Exit: $${currentPrice}`);
      console.log(`  Quantity: ${quantity}`);
      console.log(`  Dollar P&L: $${dollarProfitLoss.toFixed(2)}`);
      console.log(`  Percent P&L: ${profitPercent.toFixed(2)}%`);
      console.log(`  Config take profit target: ${this.config.take_profit_percent}%`);

      // First check if trade is already closed
      const { data: currentTrade } = await supabase
        .from('trades')
        .select('status')
        .eq('id', trade.id)
        .single();

      if (currentTrade?.status === 'closed') {
        console.log(`Trade ${trade.id} is already closed, skipping`);
        return;
      }

      // Update trade status to closed with correct P&L
      // Use only 'closed' status which should be valid
      const { error } = await supabase
        .from('trades')
        .update({
          status: 'closed',
          profit_loss: dollarProfitLoss,
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id)
        .eq('status', 'filled');

      if (error) {
        console.error(`Database error closing position:`, error);
        throw error;
      }

      console.log(`✅ Position closed successfully for ${trade.symbol}`);
      
      await this.logActivity('position_closed', `Position closed for ${trade.symbol}`, {
        symbol: trade.symbol,
        entryPrice,
        exitPrice: currentPrice,
        quantity,
        dollarProfitLoss,
        profitPercent,
        takeProfitTarget: this.config.take_profit_percent,
        tradeId: trade.id,
        configUsed: {
          takeProfitPercent: this.config.take_profit_percent,
          maxPositionsPerPair: this.config.max_positions_per_pair
        }
      });

    } catch (error) {
      console.error(`Error closing position for ${trade.symbol}:`, error);
      await this.logActivity('close_error', `Failed to close position for ${trade.symbol}`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        tradeId: trade.id,
        symbol: trade.symbol 
      });
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
