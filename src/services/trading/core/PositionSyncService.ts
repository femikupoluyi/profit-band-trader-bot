
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';

export class PositionSyncService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
  }

  async syncAllPositionsWithExchange(): Promise<void> {
    try {
      console.log('🔄 Starting comprehensive position sync with exchange...');
      await this.logger.logSuccess('Starting position sync with exchange');

      // Get all local active trades
      const { data: localActiveTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'filled', 'partial_filled']);

      if (error) {
        console.error('❌ Error fetching local active trades:', error);
        await this.logger.logError('Failed to fetch local active trades', error);
        return;
      }

      if (!localActiveTrades || localActiveTrades.length === 0) {
        console.log('📭 No local active trades to sync');
        return;
      }

      console.log(`📊 Found ${localActiveTrades.length} local active trades to sync`);

      // Get current account balance to check actual positions
      const accountBalance = await this.getAccountBalance();
      
      // Get recent order history from exchange
      const exchangeOrders = await this.getExchangeOrderHistory();

      // Sync each local trade
      for (const trade of localActiveTrades) {
        await this.syncSinglePosition(trade, accountBalance, exchangeOrders);
      }

      console.log('✅ Position sync completed');
      await this.logger.logSuccess('Position sync completed successfully');

    } catch (error) {
      console.error('❌ Error during position sync:', error);
      await this.logger.logError('Position sync failed', error);
    }
  }

  private async syncSinglePosition(
    localTrade: any, 
    accountBalance: Map<string, number>, 
    exchangeOrders: any[]
  ): Promise<void> {
    try {
      console.log(`🔍 Syncing position: ${localTrade.symbol} (${localTrade.status})`);

      // Extract base asset from symbol (e.g., BTC from BTCUSDT)
      const baseAsset = localTrade.symbol.replace('USDT', '');
      const currentBalance = accountBalance.get(baseAsset) || 0;
      
      // Check if we still have the asset in our balance
      const hasPosition = currentBalance > 0.00001; // Small threshold for floating point precision
      
      console.log(`Balance check for ${baseAsset}: ${currentBalance}, Has position: ${hasPosition}`);

      // If no balance and trade is marked as filled, it was likely closed
      if (!hasPosition && localTrade.status === 'filled') {
        console.log(`🎯 Detected closed position for ${localTrade.symbol} - no balance remaining`);
        await this.markTradeAsClosed(localTrade, 'balance_check');
        return;
      }

      // Check order status on exchange if we have a Bybit order ID
      if (localTrade.bybit_order_id && !localTrade.bybit_order_id.startsWith('mock_')) {
        await this.checkOrderStatusOnExchange(localTrade, exchangeOrders);
      }

      // Additional check: look for matching sell orders in history
      if (localTrade.status === 'filled' && localTrade.side === 'buy') {
        await this.checkForMatchingSellOrder(localTrade, exchangeOrders);
      }

    } catch (error) {
      console.error(`❌ Error syncing position ${localTrade.symbol}:`, error);
      await this.logger.logError(`Failed to sync position ${localTrade.symbol}`, error);
    }
  }

  private async getAccountBalance(): Promise<Map<string, number>> {
    try {
      const balanceResponse = await this.bybitService.getAccountBalance();
      const balanceMap = new Map<string, number>();

      if (balanceResponse.retCode === 0 && balanceResponse.result?.list?.[0]?.coin) {
        balanceResponse.result.list[0].coin.forEach((coin: any) => {
          balanceMap.set(coin.coin, parseFloat(coin.walletBalance || '0'));
        });
      }

      return balanceMap;
    } catch (error) {
      console.error('❌ Error fetching account balance:', error);
      return new Map();
    }
  }

  private async getExchangeOrderHistory(): Promise<any[]> {
    try {
      const historyResponse = await this.bybitService.getOrderHistory(50);
      
      if (historyResponse.retCode === 0 && historyResponse.result?.list) {
        return historyResponse.result.list;
      }

      return [];
    } catch (error) {
      console.error('❌ Error fetching exchange order history:', error);
      return [];
    }
  }

  private async checkOrderStatusOnExchange(localTrade: any, exchangeOrders: any[]): Promise<void> {
    try {
      // First try to get specific order status
      const orderStatus = await this.bybitService.getOrderStatus(localTrade.bybit_order_id);
      
      if (orderStatus.retCode === 0 && orderStatus.result?.list?.length > 0) {
        const order = orderStatus.result.list[0];
        
        if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Rejected') {
          console.log(`🔄 Order ${localTrade.bybit_order_id} was ${order.orderStatus} on exchange`);
          await this.markTradeAsClosed(localTrade, 'exchange_cancelled');
          return;
        }
      }

      // Also check in order history
      const matchingOrder = exchangeOrders.find(order => 
        order.orderId === localTrade.bybit_order_id
      );

      if (matchingOrder) {
        if (['Cancelled', 'Rejected'].includes(matchingOrder.orderStatus)) {
          console.log(`🔄 Found cancelled/rejected order in history: ${localTrade.bybit_order_id}`);
          await this.markTradeAsClosed(localTrade, 'exchange_cancelled');
        }
      }

    } catch (error) {
      console.error(`❌ Error checking order status for ${localTrade.bybit_order_id}:`, error);
    }
  }

  private async checkForMatchingSellOrder(localTrade: any, exchangeOrders: any[]): Promise<void> {
    try {
      // Look for sell orders that match our buy position
      const matchingSellOrders = exchangeOrders.filter(order => 
        order.symbol === localTrade.symbol &&
        order.side === 'Sell' &&
        order.orderStatus === 'Filled' &&
        Math.abs(parseFloat(order.qty) - localTrade.quantity) < localTrade.quantity * 0.05 // 5% tolerance
      );

      if (matchingSellOrders.length > 0) {
        const sellOrder = matchingSellOrders[0];
        console.log(`🎯 Found matching sell order for ${localTrade.symbol}: ${sellOrder.orderId}`);
        
        // Calculate P&L from the sell order
        const buyPrice = localTrade.buy_fill_price || localTrade.price;
        const sellPrice = parseFloat(sellOrder.avgPrice || sellOrder.price);
        const quantity = parseFloat(sellOrder.qty);
        const profitLoss = (sellPrice - buyPrice) * quantity;

        await this.markTradeAsClosed(localTrade, 'matching_sell_order', profitLoss, {
          sellOrderId: sellOrder.orderId,
          sellPrice,
          sellQuantity: quantity
        });
      }

    } catch (error) {
      console.error(`❌ Error checking for matching sell order:`, error);
    }
  }

  private async markTradeAsClosed(
    trade: any, 
    reason: string, 
    profitLoss?: number,
    additionalData?: any
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
        .in('status', ['pending', 'filled', 'partial_filled']); // Only update if still active

      if (error) {
        console.error(`❌ Error updating trade ${trade.id} to closed:`, error);
        await this.logger.logError(`Failed to close trade ${trade.id}`, error);
      } else {
        console.log(`✅ Marked trade ${trade.id} (${trade.symbol}) as closed - Reason: ${reason}`);
        await this.logger.log('position_closed', `Auto-closed ${trade.symbol} position via sync`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          reason,
          profitLoss,
          ...additionalData
        });
      }

    } catch (error) {
      console.error(`❌ Error marking trade as closed:`, error);
    }
  }

  async performStartupSync(): Promise<void> {
    console.log('🚀 Performing startup position sync...');
    await this.syncAllPositionsWithExchange();
  }
}
