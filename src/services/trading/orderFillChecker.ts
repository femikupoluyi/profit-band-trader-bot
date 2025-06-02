
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { TradeSyncService } from './tradeSyncService';

export class OrderFillChecker {
  private userId: string;
  private bybitService: BybitService;
  private tradeSyncService: TradeSyncService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.tradeSyncService = new TradeSyncService(userId, bybitService);
  }

  async checkAndFillPendingOrders(): Promise<void> {
    try {
      console.log('🔍 Checking pending orders for fill conditions...');

      // First, sync all active trades with Bybit to get real status
      await this.tradeSyncService.syncAllActiveTrades();

      // Get remaining pending orders after sync
      const { data: pendingTrades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'pending');

      if (!pendingTrades || pendingTrades.length === 0) {
        console.log('No pending orders to check');
        return;
      }

      console.log(`Checking ${pendingTrades.length} pending orders...`);

      for (const trade of pendingTrades) {
        await this.checkOrderFillCondition(trade);
      }

      console.log('✅ Completed checking pending orders');
    } catch (error) {
      console.error('Error checking pending orders:', error);
    }
  }

  private async checkOrderFillCondition(trade: any): Promise<void> {
    try {
      console.log(`\n📊 Checking fill condition for ${trade.symbol} order ${trade.id}:`);
      console.log(`  Order Type: ${trade.order_type}`);
      console.log(`  Side: ${trade.side}`);
      console.log(`  Price: $${trade.price}`);
      console.log(`  Status: ${trade.status}`);

      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      
      console.log(`  Current Market Price: $${currentPrice}`);

      let shouldFill = false;
      let fillReason = '';

      // Check fill conditions based on order type
      if (trade.order_type === 'market') {
        // Market orders should fill immediately
        shouldFill = true;
        fillReason = 'Market order should fill immediately';
      } else if (trade.order_type === 'limit') {
        // Limit order fill conditions
        if (trade.side === 'buy' && currentPrice <= trade.price) {
          shouldFill = true;
          fillReason = `Buy limit triggered: market price ${currentPrice} <= limit ${trade.price}`;
        } else if (trade.side === 'sell' && currentPrice >= trade.price) {
          shouldFill = true;
          fillReason = `Sell limit triggered: market price ${currentPrice} >= limit ${trade.price}`;
        }
      }

      if (shouldFill) {
        console.log(`🎯 Fill condition met: ${fillReason}`);
        await this.fillOrder(trade, currentPrice);
      } else {
        console.log(`📈 Fill condition not met for ${trade.symbol}`);
      }

    } catch (error) {
      console.error(`Error checking fill condition for trade ${trade.id}:`, error);
    }
  }

  private async fillOrder(trade: any, fillPrice: number): Promise<void> {
    try {
      console.log(`💰 Filling order for ${trade.symbol}:`);
      console.log(`  Fill Price: $${fillPrice}`);
      console.log(`  Quantity: ${trade.quantity}`);

      // Update trade status to filled with actual fill price
      const { error: updateError } = await supabase
        .from('trades')
        .update({
          status: 'filled',
          price: fillPrice, // Use actual fill price
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id)
        .eq('status', 'pending'); // Only update if still pending

      if (updateError) {
        console.error('Error updating trade to filled:', updateError);
        return;
      }

      console.log(`✅ Order filled successfully for ${trade.symbol}`);

      // Log the fill
      await this.logActivity('trade_filled', `Order filled for ${trade.symbol} at $${fillPrice}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        fillPrice,
        quantity: trade.quantity,
        originalPrice: trade.price,
        orderType: trade.order_type
      });

      // Verify the fill with Bybit if we have a real order ID
      if (trade.bybit_order_id && !trade.bybit_order_id.startsWith('mock_')) {
        setTimeout(() => {
          this.tradeSyncService.syncTradeWithBybit(trade.id);
        }, 1000);
      }

    } catch (error) {
      console.error(`Error filling order for ${trade.symbol}:`, error);
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      const validLogTypes = [
        'signal_processed', 'trade_executed', 'trade_filled', 'position_closed',
        'system_error', 'order_placed', 'order_failed', 'calculation_error',
        'execution_error', 'signal_rejected', 'order_rejected'
      ];

      const validType = validLogTypes.includes(type) ? type : 'system_error';

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
