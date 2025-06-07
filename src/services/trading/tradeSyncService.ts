
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';

export class TradeSyncService {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async syncTradeWithBybit(tradeId: string): Promise<boolean> {
    try {
      console.log(`🔄 Syncing trade ${tradeId} with Bybit...`);

      // Get local trade record
      const { data: trade, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (error || !trade) {
        console.error('Trade not found:', error);
        return false;
      }

      // Skip if no Bybit order ID
      if (!trade.bybit_order_id || trade.bybit_order_id.startsWith('mock_')) {
        console.log('No valid Bybit order ID, skipping sync');
        return false;
      }

      // Skip if already closed
      if (trade.status === 'closed') {
        console.log(`Trade ${trade.id} is already closed, skipping sync`);
        return false;
      }

      // Get order status from Bybit
      const bybitStatus = await this.bybitService.getOrderStatus(trade.bybit_order_id);
      
      if (bybitStatus.retCode !== 0) {
        console.error('Failed to get Bybit order status:', bybitStatus);
        return false;
      }

      const orderData = bybitStatus.result?.list?.[0];
      if (!orderData) {
        console.error('No order data from Bybit');
        return false;
      }

      console.log(`Bybit order status: ${orderData.orderStatus}, avgPrice: ${orderData.avgPrice}, cumExecQty: ${orderData.cumExecQty}`);

      // Map Bybit status to our status with enhanced detection
      let newStatus = trade.status;
      let actualFillPrice = trade.price;
      let actualQuantity = trade.quantity;
      let statusChanged = false;

      switch (orderData.orderStatus) {
        case 'Filled':
          if (trade.status !== 'filled' && trade.status !== 'closed') {
            newStatus = 'filled';
            actualFillPrice = parseFloat(orderData.avgPrice || orderData.price || trade.price);
            actualQuantity = parseFloat(orderData.cumExecQty || orderData.qty || trade.quantity);
            statusChanged = true;
            console.log(`✅ Order ${trade.bybit_order_id} is FILLED - updating to filled status`);
          }
          break;
        case 'PartiallyFilled':
          if (trade.status !== 'partial_filled') {
            newStatus = 'partial_filled';
            actualFillPrice = parseFloat(orderData.avgPrice || orderData.price || trade.price);
            actualQuantity = parseFloat(orderData.cumExecQty || trade.quantity);
            statusChanged = true;
            console.log(`⚠️ Order ${trade.bybit_order_id} is PARTIALLY FILLED`);
          }
          break;
        case 'Cancelled':
        case 'Rejected':
          if (trade.status !== 'cancelled') {
            newStatus = 'cancelled';
            statusChanged = true;
            console.log(`❌ Order ${trade.bybit_order_id} is CANCELLED/REJECTED`);
          }
          break;
        case 'New':
        case 'PartiallyFilledCanceled':
          if (trade.status !== 'pending') {
            newStatus = 'pending';
            statusChanged = true;
          }
          break;
        default:
          console.log(`Unknown Bybit status: ${orderData.orderStatus}`);
          return false;
      }

      // Update local record if status changed or price/quantity differs
      const priceChanged = Math.abs(actualFillPrice - trade.price) > 0.000001;
      const quantityChanged = Math.abs(actualQuantity - trade.quantity) > 0.000001;

      if (statusChanged || priceChanged || quantityChanged) {
        const updateData: any = {
          updated_at: new Date().toISOString()
        };

        if (statusChanged) {
          updateData.status = newStatus;
        }
        if (priceChanged) {
          updateData.price = actualFillPrice;
        }
        if (quantityChanged) {
          updateData.quantity = actualQuantity;
        }

        const { error: updateError } = await supabase
          .from('trades')
          .update(updateData)
          .eq('id', tradeId);

        if (updateError) {
          console.error('Failed to update trade status:', updateError);
          return false;
        }

        console.log(`✅ Trade ${tradeId} synced: ${trade.status} → ${newStatus}, Price: ${trade.price} → ${actualFillPrice}, Qty: ${trade.quantity} → ${actualQuantity}`);
        
        // Log the sync activity with detailed information
        await this.logActivity('trade_synced', `Trade ${trade.symbol} synced with Bybit - Status: ${trade.status} → ${newStatus}`, {
          tradeId,
          symbol: trade.symbol,
          oldStatus: trade.status,
          newStatus,
          oldPrice: trade.price,
          newPrice: actualFillPrice,
          oldQuantity: trade.quantity,
          newQuantity: actualQuantity,
          bybitOrderId: trade.bybit_order_id,
          bybitStatus: orderData.orderStatus,
          bybitAvgPrice: orderData.avgPrice,
          bybitCumExecQty: orderData.cumExecQty
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error syncing trade ${tradeId}:`, error);
      return false;
    }
  }

  async syncAllActiveTrades(): Promise<void> {
    try {
      console.log('🔄 Syncing all active trades with Bybit...');

      // Get all active trades (including filled ones to detect closed positions)
      const { data: activeTrades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'partial_filled', 'filled'])
        .not('bybit_order_id', 'is', null)
        .not('bybit_order_id', 'like', 'mock_%');

      if (!activeTrades || activeTrades.length === 0) {
        console.log('No active trades to sync');
        return;
      }

      console.log(`Syncing ${activeTrades.length} active trades...`);

      for (const trade of activeTrades) {
        await this.syncTradeWithBybit(trade.id);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log('✅ Completed syncing all active trades');
    } catch (error) {
      console.error('Error syncing active trades:', error);
    }
  }

  async detectAndRecordClosedPositions(): Promise<void> {
    try {
      console.log('🔍 Detecting closed positions from Bybit...');

      // Get all filled trades that might have been closed
      const { data: filledTrades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'filled')
        .not('bybit_order_id', 'is', null)
        .not('bybit_order_id', 'like', 'mock_%');

      if (!filledTrades || filledTrades.length === 0) {
        console.log('No filled trades to check for closure');
        return;
      }

      console.log(`Checking ${filledTrades.length} filled trades for potential closure...`);

      // Get current account balance to see which positions still exist
      const balanceData = await this.bybitService.getAccountBalance();
      
      if (balanceData.retCode !== 0 || !balanceData.result?.list?.[0]?.coin) {
        console.error('Failed to get account balance for position detection');
        return;
      }

      const coins = balanceData.result.list[0].coin;
      const coinBalances = new Map();
      
      // Create a map of current coin balances
      coins.forEach((coin: any) => {
        coinBalances.set(coin.coin, parseFloat(coin.walletBalance || '0'));
      });

      // Check each filled trade to see if position still exists
      for (const trade of filledTrades) {
        try {
          const baseSymbol = trade.symbol.replace('USDT', '');
          const currentBalance = coinBalances.get(baseSymbol) || 0;
          
          console.log(`Checking ${trade.symbol}: Current ${baseSymbol} balance: ${currentBalance}, Trade quantity: ${trade.quantity}`);
          
          // If balance is zero or significantly less than trade quantity, position was likely closed
          if (currentBalance === 0 || currentBalance < trade.quantity * 0.1) {
            console.log(`🎯 Detected closed position for ${trade.symbol} - updating status (balance: ${currentBalance})`);
            
            // Update trade status to closed
            const { error: updateError } = await supabase
              .from('trades')
              .update({
                status: 'closed',
                updated_at: new Date().toISOString()
              })
              .eq('id', trade.id)
              .eq('status', 'filled'); // Only update if still filled

            if (updateError) {
              console.error(`Error updating trade ${trade.id} to closed:`, updateError);
            } else {
              await this.logActivity('position_closed', `Auto-detected closed position for ${trade.symbol} via balance check`, {
                tradeId: trade.id,
                symbol: trade.symbol,
                detectionMethod: 'balance_check',
                currentBalance,
                tradeQuantity: trade.quantity,
                balanceRatio: currentBalance / trade.quantity
              });
            }
          } else {
            console.log(`Position ${trade.symbol} still active - balance: ${currentBalance} >= threshold`);
          }
        } catch (error) {
          console.error(`Error checking balance for ${trade.symbol}:`, error);
        }
      }

      // Additional check: Look for sell orders in Bybit history that we might have missed
      await this.detectClosedPositionsFromOrderHistory();

    } catch (error) {
      console.error('Error detecting closed positions:', error);
    }
  }

  private async detectClosedPositionsFromOrderHistory(): Promise<void> {
    try {
      console.log('🔍 Checking Bybit order history for missed sell orders...');
      
      // Get recent order history from Bybit
      const orderHistory = await this.bybitService.getOrderHistory();
      
      if (orderHistory.retCode !== 0 || !orderHistory.result?.list) {
        console.log('No order history available');
        return;
      }

      // Look for sell orders that might correspond to our filled trades
      const sellOrders = orderHistory.result.list.filter((order: any) => 
        order.side === 'Sell' && order.orderStatus === 'Filled'
      );

      if (sellOrders.length === 0) {
        console.log('No filled sell orders found in recent history');
        return;
      }

      console.log(`Found ${sellOrders.length} filled sell orders in Bybit history`);

      // Get our filled trades to match against
      const { data: filledTrades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'filled');

      if (!filledTrades || filledTrades.length === 0) {
        return;
      }

      // Try to match sell orders with our positions
      for (const sellOrder of sellOrders) {
        const matchingTrade = filledTrades.find(trade => 
          trade.symbol === sellOrder.symbol && 
          Math.abs(parseFloat(sellOrder.qty) - trade.quantity) < trade.quantity * 0.05 // 5% tolerance
        );

        if (matchingTrade) {
          console.log(`🎯 Found matching sell order for ${matchingTrade.symbol} - marking as closed`);
          
          const { error: updateError } = await supabase
            .from('trades')
            .update({
              status: 'closed',
              updated_at: new Date().toISOString()
            })
            .eq('id', matchingTrade.id)
            .eq('status', 'filled');

          if (!updateError) {
            await this.logActivity('position_closed', `Auto-detected closed position for ${matchingTrade.symbol} via order history`, {
              tradeId: matchingTrade.id,
              symbol: matchingTrade.symbol,
              detectionMethod: 'order_history_match',
              bybitSellOrderId: sellOrder.orderId,
              sellQuantity: sellOrder.qty,
              sellPrice: sellOrder.avgPrice
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking order history:', error);
    }
  }

  async verifyOrderPlacement(tradeId: string, maxRetries: number = 3): Promise<boolean> {
    try {
      console.log(`🔍 Verifying order placement for trade ${tradeId}...`);

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Verification attempt ${attempt}/${maxRetries}`);

        // Wait a bit for order to appear in Bybit system
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));

        const success = await this.syncTradeWithBybit(tradeId);
        if (success) {
          console.log(`✅ Order verification successful on attempt ${attempt}`);
          return true;
        }
      }

      console.error(`❌ Order verification failed after ${maxRetries} attempts`);
      
      // Mark trade as failed if verification fails
      await supabase
        .from('trades')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId);

      await this.logActivity('order_verification_failed', `Order verification failed for trade ${tradeId}`, {
        tradeId,
        maxRetries
      });

      return false;
    } catch (error) {
      console.error(`Error verifying order placement for trade ${tradeId}:`, error);
      return false;
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      const validLogTypes = [
        'signal_processed', 'trade_executed', 'trade_filled', 'position_closed',
        'system_error', 'order_placed', 'order_failed', 'calculation_error',
        'execution_error', 'signal_rejected', 'order_rejected', 'trade_synced'
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
