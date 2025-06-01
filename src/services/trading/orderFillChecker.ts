
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';

export class OrderFillChecker {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async checkAndFillPendingOrders(): Promise<void> {
    console.log('🔍 Checking pending orders for fill conditions...');
    
    try {
      // Get all pending orders
      const { data: pendingTrades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'pending');

      if (!pendingTrades || pendingTrades.length === 0) {
        console.log('No pending orders to check');
        return;
      }

      console.log(`Found ${pendingTrades.length} pending orders to check`);

      for (const trade of pendingTrades) {
        await this.checkOrderFillCondition(trade);
      }
    } catch (error) {
      console.error('Error checking pending orders:', error);
      await this.logActivity('system_error', 'Error checking pending orders', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async checkOrderFillCondition(trade: any): Promise<void> {
    try {
      console.log(`\n📋 Checking fill condition for ${trade.symbol}:`);
      console.log(`  Trade ID: ${trade.id}`);
      console.log(`  Side: ${trade.side}`);
      console.log(`  Entry Price: $${trade.price}`);
      console.log(`  Order Type: ${trade.order_type}`);

      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      
      console.log(`  Current Market Price: $${currentPrice}`);

      const entryPrice = parseFloat(trade.price.toString());
      let shouldFill = false;

      // For market orders, they should fill immediately at current market price
      if (trade.order_type === 'market') {
        shouldFill = true;
        console.log(`  ✅ Market order should be filled immediately`);
      }
      // For limit orders, check if market price meets the limit condition
      else if (trade.order_type === 'limit') {
        if (trade.side === 'buy' && currentPrice <= entryPrice) {
          shouldFill = true;
          console.log(`  ✅ BUY limit order condition met: ${currentPrice} <= ${entryPrice}`);
        } else if (trade.side === 'sell' && currentPrice >= entryPrice) {
          shouldFill = true;
          console.log(`  ✅ SELL limit order condition met: ${currentPrice} >= ${entryPrice}`);
        } else {
          console.log(`  ⏳ Limit order condition not met yet`);
        }
      }

      if (shouldFill) {
        await this.fillOrder(trade, currentPrice);
      }
    } catch (error) {
      console.error(`Error checking fill condition for trade ${trade.id}:`, error);
      await this.logActivity('system_error', `Failed to check fill condition for trade ${trade.id}`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        tradeId: trade.id,
        symbol: trade.symbol 
      });
    }
  }

  private async fillOrder(trade: any, fillPrice: number): Promise<void> {
    try {
      console.log(`\n💰 Filling order for ${trade.symbol}:`);
      console.log(`  Trade ID: ${trade.id}`);
      console.log(`  Original Entry Price: $${trade.price}`);
      console.log(`  Fill Price: $${fillPrice}`);
      console.log(`  Side: ${trade.side}`);

      // Update the trade to filled status with the actual fill price
      const { error: updateError } = await supabase
        .from('trades')
        .update({
          status: 'filled' as const,
          price: fillPrice, // Update to actual fill price
          updated_at: new Date().toISOString(),
        })
        .eq('id', trade.id)
        .eq('status', 'pending'); // Only update if still pending

      if (updateError) {
        console.error(`Error filling order:`, updateError);
        throw updateError;
      }

      console.log(`✅ Order filled successfully for ${trade.symbol} at $${fillPrice}`);
      
      await this.logActivity('trade_filled', `Order filled for ${trade.symbol}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        originalEntryPrice: trade.price,
        actualFillPrice: fillPrice,
        side: trade.side,
        quantity: trade.quantity,
        orderType: trade.order_type
      });

    } catch (error) {
      console.error(`Error filling order for ${trade.symbol}:`, error);
      await this.logActivity('system_error', `Failed to fill order for ${trade.symbol}`, { 
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
