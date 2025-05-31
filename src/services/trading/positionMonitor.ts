
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class PositionMonitor {
  private userId: string;
  private bybitService: BybitService;
  private config: TradingConfigData;

  constructor(userId: string, bybitService: BybitService, config: TradingConfigData) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.config = config;
    
    // Validate config values with proper defaults
    this.config = {
      ...config,
      take_profit_percent: config.take_profit_percent || 2.0,
      entry_offset_percent: config.entry_offset_percent || 1.0,
      max_positions_per_pair: config.max_positions_per_pair || 2,
      new_support_threshold_percent: config.new_support_threshold_percent || 2.0
    };
    
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
      const { data: activeTrades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'filled'); // Only check filled trades, not pending ones

      if (!activeTrades || activeTrades.length === 0) {
        console.log('No active filled trades to monitor');
        return;
      }

      console.log(`Monitoring ${activeTrades.length} filled trades using config take profit: ${this.config.take_profit_percent}%...`);

      for (const trade of activeTrades) {
        await this.checkTradeForClosure(trade);
      }
    } catch (error) {
      console.error('Error in position monitoring:', error);
      await this.logActivity('error', 'Position monitoring failed', { error: error.message });
    }
  }

  private async checkTradeForClosure(trade: any): Promise<void> {
    try {
      console.log(`\n📊 Checking trade ${trade.id} for ${trade.symbol}:`);
      console.log(`  Entry Price: $${trade.price}`);
      console.log(`  Side: ${trade.side}`);
      console.log(`  Status: ${trade.status}`);
      console.log(`  Take Profit Target: ${this.config.take_profit_percent}%`);

      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      
      console.log(`  Current Price: $${currentPrice}`);

      // Calculate profit/loss percentage
      const entryPrice = parseFloat(trade.price.toString());
      let profitPercent = 0;

      if (trade.side === 'buy') {
        profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      } else {
        profitPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
      }

      console.log(`  Profit/Loss: ${profitPercent.toFixed(2)}%`);
      console.log(`  Take Profit Target from config: ${this.config.take_profit_percent}%`);

      // Check if profit target is reached using config value
      if (profitPercent >= this.config.take_profit_percent) {
        console.log(`🎯 PROFIT TARGET REACHED! Closing position for ${trade.symbol} (${profitPercent.toFixed(2)}% >= ${this.config.take_profit_percent}%)`);
        await this.closePosition(trade, currentPrice, profitPercent);
      } else {
        console.log(`  📈 Position still under target (${profitPercent.toFixed(2)}% < ${this.config.take_profit_percent}%)`);
      }
    } catch (error) {
      console.error(`Error checking trade ${trade.id}:`, error);
      await this.logActivity('error', `Failed to check trade ${trade.id}`, { 
        error: error.message, 
        tradeId: trade.id,
        symbol: trade.symbol 
      });
    }
  }

  private async closePosition(trade: any, currentPrice: number, profitPercent: number): Promise<void> {
    try {
      const entryPrice = parseFloat(trade.price.toString());
      const profitLoss = ((currentPrice - entryPrice) / entryPrice) * 100;
      
      console.log(`💰 Closing position for ${trade.symbol}:`);
      console.log(`  Entry: $${entryPrice}`);
      console.log(`  Exit: $${currentPrice}`);
      console.log(`  Profit: ${profitLoss.toFixed(2)}%`);
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

      // Update trade status to closed - using exact status value from database constraint
      const { error } = await supabase
        .from('trades')
        .update({
          status: 'closed',
          profit_loss: profitLoss,
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id)
        .eq('status', 'filled'); // Only update if still filled

      if (error) {
        console.error(`Database error closing position:`, error);
        throw error;
      }

      console.log(`✅ Position closed successfully for ${trade.symbol}`);
      
      await this.logActivity('position_closed', `Position closed for ${trade.symbol}`, {
        symbol: trade.symbol,
        entryPrice,
        exitPrice: currentPrice,
        profitPercent: profitLoss,
        takeProfitTarget: this.config.take_profit_percent,
        tradeId: trade.id,
        configUsed: {
          takeProfitPercent: this.config.take_profit_percent,
          maxPositionsPerPair: this.config.max_positions_per_pair
        }
      });

    } catch (error) {
      console.error(`Error closing position for ${trade.symbol}:`, error);
      await this.logActivity('error', `Failed to close position for ${trade.symbol}`, { 
        error: error.message,
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
