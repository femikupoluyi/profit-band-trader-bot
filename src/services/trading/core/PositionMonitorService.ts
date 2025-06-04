
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfig } from '../config/TradingConfigManager';

export class PositionMonitorService {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async checkOrderFills(config: TradingConfig): Promise<void> {
    try {
      console.log('🔍 Checking order fills...');

      // Get all pending trades
      const { data: pendingTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'pending');

      if (error) throw error;

      if (!pendingTrades || pendingTrades.length === 0) {
        console.log('📭 No pending orders to check');
        return;
      }

      console.log(`📊 Checking ${pendingTrades.length} pending orders`);

      for (const trade of pendingTrades) {
        await this.checkTradeOrderFill(trade, config);
      }

      // Check filled trades for take-profit execution
      await this.checkTakeProfitFills(config);

    } catch (error) {
      console.error('❌ Error checking order fills:', error);
      throw error;
    }
  }

  private async checkTradeOrderFill(trade: any, config: TradingConfig): Promise<void> {
    try {
      if (!trade.bybit_order_id || trade.bybit_order_id.startsWith('mock_')) {
        // For mock orders, simulate fill based on current price
        await this.checkMockOrderFill(trade, config);
        return;
      }

      // Check real Bybit order status
      const orderStatus = await this.bybitService.getOrderStatus(trade.bybit_order_id);
      
      if (orderStatus.retCode === 0 && orderStatus.result?.list?.length > 0) {
        const order = orderStatus.result.list[0];
        
        if (order.orderStatus === 'Filled') {
          await this.updateTradeAsFilled(trade, parseFloat(order.avgPrice));
        }
      }
    } catch (error) {
      console.error(`❌ Error checking order ${trade.id}:`, error);
    }
  }

  private async checkMockOrderFill(trade: any, config: TradingConfig): Promise<void> {
    try {
      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      const entryPrice = parseFloat(trade.price.toString());

      // For buy limit orders, fill if current price <= entry price
      if (trade.side === 'buy' && currentPrice <= entryPrice) {
        console.log(`💰 Mock buy order filled: ${trade.symbol} at ${currentPrice} (limit: ${entryPrice})`);
        await this.updateTradeAsFilled(trade, currentPrice);
      }
    } catch (error) {
      console.error(`❌ Error checking mock order ${trade.id}:`, error);
    }
  }

  private async updateTradeAsFilled(trade: any, fillPrice: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('trades')
        .update({
          status: 'filled',
          price: fillPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id);

      if (error) throw error;

      console.log(`✅ Trade ${trade.id} marked as filled at ${fillPrice}`);
      
      await this.logActivity('trade_filled', `Order filled for ${trade.symbol} at $${fillPrice}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        fillPrice,
        quantity: trade.quantity
      });
    } catch (error) {
      console.error('❌ Error updating trade as filled:', error);
    }
  }

  private async checkTakeProfitFills(config: TradingConfig): Promise<void> {
    try {
      // Get filled trades that might have take-profit orders
      const { data: filledTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'filled');

      if (error) throw error;
      if (!filledTrades || filledTrades.length === 0) return;

      for (const trade of filledTrades) {
        await this.checkTradeTakeProfit(trade, config);
      }
    } catch (error) {
      console.error('❌ Error checking take-profit fills:', error);
    }
  }

  private async checkTradeTakeProfit(trade: any, config: TradingConfig): Promise<void> {
    try {
      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      const entryPrice = parseFloat(trade.price.toString());
      
      // Calculate take-profit price
      const takeProfitPrice = entryPrice * (1 + config.take_profit_percentage / 100);
      
      // Check if take-profit should be triggered
      if (currentPrice >= takeProfitPrice) {
        console.log(`🎯 Take-profit triggered for ${trade.symbol}: ${currentPrice} >= ${takeProfitPrice}`);
        await this.executeTakeProfit(trade, takeProfitPrice, config);
      }
    } catch (error) {
      console.error(`❌ Error checking take-profit for trade ${trade.id}:`, error);
    }
  }

  private async executeTakeProfit(trade: any, takeProfitPrice: number, config: TradingConfig): Promise<void> {
    try {
      const quantity = parseFloat(trade.quantity.toString());
      const entryPrice = parseFloat(trade.price.toString());
      const profit = (takeProfitPrice - entryPrice) * quantity;

      // Update trade as closed
      const { error } = await supabase
        .from('trades')
        .update({
          status: 'closed',
          profit_loss: profit,
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id);

      if (error) throw error;

      console.log(`✅ Take-profit executed for ${trade.symbol}: +$${profit.toFixed(2)}`);

      await this.logActivity('position_closed', `Take-profit executed for ${trade.symbol}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        entryPrice,
        exitPrice: takeProfitPrice,
        profit,
        profitPercent: ((takeProfitPrice - entryPrice) / entryPrice * 100).toFixed(2)
      });
    } catch (error) {
      console.error('❌ Error executing take-profit:', error);
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
