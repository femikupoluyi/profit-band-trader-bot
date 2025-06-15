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

      console.log(`🔍 Checking Bybit order status for: ${trade.bybit_order_id}`);

      // Get order status from Bybit with retries
      let bybitStatus;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          bybitStatus = await this.bybitService.getOrderStatus(trade.bybit_order_id);
          if (bybitStatus && bybitStatus.retCode === 0) {
            break;
          }
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`⏳ Retrying order status check (attempt ${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`❌ Attempt ${attempts + 1} failed:`, error);
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      if (!bybitStatus || bybitStatus.retCode !== 0) {
        console.error('Failed to get Bybit order status after retries:', bybitStatus);
        return false;
      }

      const orderData = bybitStatus.result?.list?.[0];
      if (!orderData) {
        console.error('No order data from Bybit');
        return false;
      }

      console.log(`📊 Bybit order data:`, {
        status: orderData.orderStatus,
        avgPrice: orderData.avgPrice,
        cumExecQty: orderData.cumExecQty,
        qty: orderData.qty
      });

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
            console.log(`✅ Order ${trade.bybit_order_id} is FILLED - updating status`);
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
          console.log(`❓ Unknown Bybit status: ${orderData.orderStatus}`);
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
          // Store fill price separately for reference
          if (trade.side === 'buy') {
            updateData.buy_fill_price = actualFillPrice;
          }
        }
        if (quantityChanged) {
          updateData.quantity = actualQuantity;
        }

        console.log(`📝 Updating trade ${tradeId} with:`, updateData);

        const { error: updateError } = await supabase
          .from('trades')
          .update(updateData)
          .eq('id', tradeId);

        if (updateError) {
          console.error('❌ Failed to update trade status:', updateError);
          return false;
        }

        console.log(`✅ Trade ${tradeId} synced successfully`);
        
        // Log the sync activity
        await this.logActivity('trade_synced', `Trade ${trade.symbol} synced with Bybit`, {
          tradeId,
          symbol: trade.symbol,
          oldStatus: trade.status,
          newStatus,
          bybitOrderId: trade.bybit_order_id,
          statusChanged,
          priceChanged,
          quantityChanged
        });

        return true;
      }

      console.log(`ℹ️ No changes needed for trade ${tradeId}`);
      return false;
    } catch (error) {
      console.error(`❌ Error syncing trade ${tradeId}:`, error);
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
        console.log('📭 No active trades to sync');
        return;
      }

      console.log(`📊 Found ${activeTrades.length} active trades to sync`);

      // Sync trades in smaller batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < activeTrades.length; i += batchSize) {
        const batch = activeTrades.slice(i, i + batchSize);
        console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} trades)`);
        
        const syncPromises = batch.map(trade => this.syncTradeWithBybit(trade.id));
        await Promise.allSettled(syncPromises);
        
        // Small delay between batches
        if (i + batchSize < activeTrades.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('✅ Completed syncing all active trades');
    } catch (error) {
      console.error('❌ Error syncing active trades:', error);
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
        console.log('📭 No filled trades to check for closure');
        return;
      }

      console.log(`🔍 Checking ${filledTrades.length} filled trades for potential closure`);

      // Get current account balance
      const balanceData = await this.bybitService.getAccountBalance();
      
      if (balanceData.retCode !== 0 || !balanceData.result?.list?.[0]?.coin) {
        console.warn('⚠️ Failed to get account balance for position detection');
        return;
      }

      const coins = balanceData.result.list[0].coin;
      const coinBalances = new Map();
      
      // Create a map of current coin balances
      coins.forEach((coin: any) => {
        coinBalances.set(coin.coin, parseFloat(coin.walletBalance || '0'));
      });

      console.log(`💰 Current balances:`, Object.fromEntries(coinBalances));

      // Check each filled trade
      for (const trade of filledTrades) {
        try {
          const baseSymbol = trade.symbol.replace('USDT', '');
          const currentBalance = coinBalances.get(baseSymbol) || 0;
          const tradeQuantity = parseFloat(trade.quantity.toString());
          
          console.log(`🔍 ${trade.symbol}: Balance=${currentBalance}, Trade Qty=${tradeQuantity}`);
          
          // If balance is significantly less than trade quantity, position was likely closed
          const threshold = tradeQuantity * 0.05; // 5% threshold
          if (currentBalance < threshold) {
            console.log(`🎯 Detected closed position for ${trade.symbol} (balance: ${currentBalance} < threshold: ${threshold})`);
            
            await this.markTradeAsClosed(trade, 'balance_check', currentBalance, tradeQuantity);
          }
        } catch (error) {
          console.error(`❌ Error checking balance for ${trade.symbol}:`, error);
        }
      }

      // Additional check: Look for sell orders in Bybit history
      await this.detectClosedPositionsFromOrderHistory();

    } catch (error) {
      console.error('❌ Error detecting closed positions:', error);
    }
  }

  private async detectClosedPositionsFromOrderHistory(): Promise<void> {
    try {
      console.log('📋 Checking Bybit order history for sell orders...');
      
      const orderHistory = await this.bybitService.getOrderHistory(50);
      
      if (orderHistory.retCode !== 0 || !orderHistory.result?.list) {
        console.log('📭 No order history available');
        return;
      }

      const sellOrders = orderHistory.result.list.filter((order: any) => 
        order.side === 'Sell' && order.orderStatus === 'Filled'
      );

      if (sellOrders.length === 0) {
        console.log('📭 No filled sell orders found');
        return;
      }

      console.log(`📊 Found ${sellOrders.length} filled sell orders`);

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
        const sellQuantity = parseFloat(sellOrder.qty);
        const matchingTrade = filledTrades.find(trade => {
          const tradeQuantity = parseFloat(trade.quantity.toString());
          return (
            trade.symbol === sellOrder.symbol && 
            Math.abs(sellQuantity - tradeQuantity) < tradeQuantity * 0.05 // 5% tolerance
          );
        });

        if (matchingTrade) {
          console.log(`🎯 Found matching sell order for ${matchingTrade.symbol}`);
          
          const sellPrice = parseFloat(sellOrder.avgPrice || sellOrder.price);
          const buyPrice = matchingTrade.buy_fill_price ? 
            parseFloat(matchingTrade.buy_fill_price.toString()) : 
            parseFloat(matchingTrade.price.toString());
          
          const profitLoss = (sellPrice - buyPrice) * sellQuantity;
          
          await this.markTradeAsClosed(matchingTrade, 'order_history_match', sellPrice, sellQuantity, profitLoss);
        }
      }
    } catch (error) {
      console.error('❌ Error checking order history:', error);
    }
  }

  private async markTradeAsClosed(
    trade: any, 
    reason: string, 
    sellPrice?: number, 
    sellQuantity?: number, 
    profitLoss?: number
  ): Promise<void> {
    try {
      const updateData: any = {
        status: 'closed',
        updated_at: new Date().toISOString()
      };

      if (profitLoss !== undefined) {
        updateData.profit_loss = profitLoss;
      }

      const { error } = await supabase
        .from('trades')
        .update(updateData)
        .eq('id', trade.id)
        .eq('status', 'filled'); // Only update if still filled

      if (error) {
        console.error(`❌ Error closing trade ${trade.id}:`, error);
      } else {
        console.log(`✅ Marked trade ${trade.id} (${trade.symbol}) as closed - Reason: ${reason}`);
        
        await this.logActivity('position_closed', `Auto-closed ${trade.symbol} position`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          reason,
          sellPrice,
          sellQuantity,
          profitLoss
        });
      }
    } catch (error) {
      console.error(`❌ Error marking trade as closed:`, error);
    }
  }

  async verifyOrderPlacement(tradeId: string, maxRetries: number = 5): Promise<boolean> {
    try {
      console.log(`🔍 Verifying order placement for trade ${tradeId}...`);

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`📡 Verification attempt ${attempt}/${maxRetries}`);

        // Progressive delay
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));

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
      console.error(`❌ Error verifying order placement for trade ${tradeId}:`, error);
      return false;
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      const validLogTypes = [
        'signal_processed', 'trade_executed', 'trade_filled', 'position_closed',
        'system_error', 'order_placed', 'order_failed', 'calculation_error',
        'execution_error', 'signal_rejected', 'order_rejected', 'trade_synced',
        'order_verification_failed'
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
      console.error('❌ Error logging activity:', error);
    }
  }
}
