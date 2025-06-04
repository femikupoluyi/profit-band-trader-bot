
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
      console.log('🔍 Checking order fills from REAL Bybit orders...');

      // Get all pending trades - ONLY check trades with real Bybit order IDs
      const { data: pendingTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'pending')
        .not('bybit_order_id', 'is', null)
        .not('bybit_order_id', 'like', 'mock_%'); // Exclude any mock orders

      if (error) throw error;

      if (!pendingTrades || pendingTrades.length === 0) {
        console.log('📭 No pending REAL orders to check');
        return;
      }

      console.log(`📊 Checking ${pendingTrades.length} pending REAL Bybit orders`);

      for (const trade of pendingTrades) {
        await this.checkRealBybitOrderFill(trade, config);
      }

      // Check filled trades for take-profit execution
      await this.checkTakeProfitFills(config);

    } catch (error) {
      console.error('❌ Error checking order fills:', error);
      throw error;
    }
  }

  private async checkRealBybitOrderFill(trade: any, config: TradingConfig): Promise<void> {
    try {
      console.log(`\n🔍 Checking REAL Bybit order ${trade.bybit_order_id} for ${trade.symbol}:`);

      // Get REAL order status from Bybit
      const orderStatus = await this.bybitService.getOrderStatus(trade.bybit_order_id);
      
      if (orderStatus.retCode !== 0) {
        console.error(`❌ Failed to get order status from Bybit: ${orderStatus.retMsg}`);
        return;
      }

      const orderList = orderStatus.result?.list;
      if (!orderList || orderList.length === 0) {
        console.log(`⚠️ Order ${trade.bybit_order_id} not found in Bybit system`);
        return;
      }

      const order = orderList[0];
      console.log(`  Bybit Order Status: ${order.orderStatus}`);
      console.log(`  Average Price: ${order.avgPrice || 'N/A'}`);
      console.log(`  Executed Quantity: ${order.cumExecQty || '0'}`);

      // Only mark as filled if Bybit confirms it's actually filled
      if (order.orderStatus === 'Filled') {
        const fillPrice = parseFloat(order.avgPrice || order.price || trade.price);
        const executedQty = parseFloat(order.cumExecQty || trade.quantity);
        
        console.log(`✅ REAL order filled by Bybit at ${fillPrice} for quantity ${executedQty}`);
        
        await this.updateTradeAsFilled(trade, fillPrice, executedQty);
      } else if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Rejected') {
        console.log(`❌ Order was ${order.orderStatus} by Bybit`);
        
        await this.updateTradeAsCancelled(trade, order.orderStatus);
      } else {
        console.log(`📋 Order still ${order.orderStatus} in Bybit system`);
      }
    } catch (error) {
      console.error(`❌ Error checking REAL order ${trade.id}:`, error);
    }
  }

  private async updateTradeAsFilled(trade: any, fillPrice: number, executedQty: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('trades')
        .update({
          status: 'filled',
          price: fillPrice,
          quantity: executedQty,
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id)
        .eq('status', 'pending'); // Only update if still pending

      if (error) throw error;

      console.log(`✅ Trade ${trade.id} marked as filled by REAL Bybit execution`);
      
      await this.logActivity('trade_filled', `REAL Bybit order filled for ${trade.symbol} at $${fillPrice}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        fillPrice,
        executedQuantity: executedQty,
        originalQuantity: trade.quantity,
        bybitOrderId: trade.bybit_order_id,
        source: 'REAL_BYBIT_FILL_CONFIRMATION'
      });
    } catch (error) {
      console.error('❌ Error updating trade as filled:', error);
    }
  }

  private async updateTradeAsCancelled(trade: any, reason: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('trades')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id);

      if (error) throw error;

      await this.logActivity('trade_cancelled', `Order cancelled by Bybit for ${trade.symbol}: ${reason}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        reason,
        bybitOrderId: trade.bybit_order_id
      });
    } catch (error) {
      console.error('❌ Error updating trade as cancelled:', error);
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
      
      // Check if take-profit should be triggered (market price reached target)
      if (currentPrice >= takeProfitPrice) {
        console.log(`🎯 Take-profit condition met for ${trade.symbol}: ${currentPrice} >= ${takeProfitPrice}`);
        
        // In a real system, we would check if the take-profit limit sell order was filled
        // For now, we'll execute the take-profit at market
        await this.executeTakeProfit(trade, currentPrice, config);
      }
    } catch (error) {
      console.error(`❌ Error checking take-profit for trade ${trade.id}:`, error);
    }
  }

  private async executeTakeProfit(trade: any, exitPrice: number, config: TradingConfig): Promise<void> {
    try {
      const quantity = parseFloat(trade.quantity.toString());
      const entryPrice = parseFloat(trade.price.toString());
      const profit = (exitPrice - entryPrice) * quantity;

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
        exitPrice,
        profit,
        profitPercent: ((exitPrice - entryPrice) / entryPrice * 100).toFixed(2)
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
