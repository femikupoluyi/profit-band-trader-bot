
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';

export class PositionMonitor {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async monitorPositions(): Promise<void> {
    try {
      // Get all active trades for the user
      const { data: activeTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled']);

      if (error) {
        console.error('Error fetching active trades:', error);
        return;
      }

      if (!activeTrades || activeTrades.length === 0) {
        console.log('No active trades to monitor');
        return;
      }

      console.log(`Monitoring ${activeTrades.length} active positions for profit targets`);

      // Get user's trading config for take profit percentage
      const { data: config } = await supabase
        .from('trading_configs')
        .select('sell_range_offset')
        .eq('user_id', this.userId)
        .single();

      const takeProfitPercent = config?.sell_range_offset || 2.0;

      for (const trade of activeTrades) {
        try {
          await this.checkTakeProfitCondition(trade, takeProfitPercent);
        } catch (error) {
          console.error(`Error monitoring trade ${trade.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in position monitoring:', error);
      await this.logActivity('error', 'Position monitoring failed', { error: error.message });
    }
  }

  private async checkTakeProfitCondition(trade: any, takeProfitPercent: number): Promise<void> {
    try {
      // Get current market price
      const { data: currentPriceData } = await supabase
        .from('market_data')
        .select('price')
        .eq('symbol', trade.symbol)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (!currentPriceData) {
        console.log(`No current price data for ${trade.symbol}`);
        return;
      }

      const currentPrice = parseFloat(currentPriceData.price);
      const entryPrice = parseFloat(trade.price);
      const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);
      
      console.log(`Checking ${trade.symbol}: Entry ${entryPrice}, Current ${currentPrice}, TP ${takeProfitPrice.toFixed(4)} (${takeProfitPercent}%)`);

      // Check if take profit condition is met
      if (currentPrice >= takeProfitPrice) {
        console.log(`Take profit triggered for ${trade.symbol} at ${currentPrice} (target: ${takeProfitPrice.toFixed(4)})`);
        await this.executeTakeProfit(trade, currentPrice, takeProfitPercent);
      }
    } catch (error) {
      console.error(`Error checking take profit for trade ${trade.id}:`, error);
    }
  }

  private async executeTakeProfit(trade: any, currentPrice: number, takeProfitPercent: number): Promise<void> {
    try {
      // Calculate profit/loss
      const entryPrice = parseFloat(trade.price);
      const quantity = parseFloat(trade.quantity);
      const profitLoss = (currentPrice - entryPrice) * quantity;
      const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

      console.log(`Executing take profit for ${trade.symbol}: P&L ${profitLoss.toFixed(4)} USD (${profitPercent.toFixed(2)}%)`);

      // Place sell order (mock for now)
      const sellOrder = await this.bybitService.placeOrder({
        symbol: trade.symbol,
        side: 'Sell',
        orderType: 'Market',
        qty: trade.quantity.toString(),
      });

      if (sellOrder.retCode === 0) {
        // Update trade status to closed
        const { error: updateError } = await supabase
          .from('trades')
          .update({
            status: 'closed',
            profit_loss: profitLoss,
            updated_at: new Date().toISOString()
          })
          .eq('id', trade.id);

        if (updateError) {
          console.error('Error updating trade status:', updateError);
        } else {
          console.log(`Trade ${trade.id} closed with profit: ${profitLoss.toFixed(4)} USD`);
          await this.logActivity('trade', `Take profit executed for ${trade.symbol}`, {
            tradeId: trade.id,
            entryPrice,
            exitPrice: currentPrice,
            profitLoss,
            profitPercent,
            takeProfitPercent
          });
        }
      } else {
        console.error(`Failed to execute take profit sell order for ${trade.symbol}:`, sellOrder);
        await this.logActivity('error', `Take profit sell order failed for ${trade.symbol}`, { sellOrder });
      }
    } catch (error) {
      console.error(`Error executing take profit for trade ${trade.id}:`, error);
      await this.logActivity('error', `Take profit execution failed for ${trade.symbol}`, { 
        error: error.message,
        tradeId: trade.id 
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
