import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';

export class ClosedPositionDetector {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
  }

  /**
   * Detect and mark closed positions by analyzing buy/sell order pairs
   */
  async detectAndMarkClosedPositions(): Promise<void> {
    try {
      console.log('🔍 ===== DETECTING CLOSED POSITIONS =====');
      await this.logger.logSystemInfo('Starting closed position detection');

      // Get all our active buy positions
      const { data: activeBuyTrades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('side', 'buy')
        .in('status', ['filled'])
        .order('created_at', { ascending: false });

      if (!activeBuyTrades || activeBuyTrades.length === 0) {
        console.log('📭 No active buy positions to check');
        return;
      }

      console.log(`📊 Found ${activeBuyTrades.length} active buy positions to analyze`);

      // Get recent order history from Bybit to find sell orders
      const sellOrders = await this.getRecentSellOrders();
      
      if (sellOrders.length === 0) {
        console.log('📭 No recent sell orders found on Bybit');
        return;
      }

      console.log(`📊 Found ${sellOrders.length} sell orders on Bybit`);

      let closedCount = 0;

      // Check each active buy position against sell orders
      for (const buyTrade of activeBuyTrades) {
        const wasClosed = await this.checkIfPositionWasClosed(buyTrade, sellOrders);
        if (wasClosed) closedCount++;
      }

      console.log(`✅ Closed position detection complete: ${closedCount} positions marked as closed`);
      
      await this.logger.logSuccess('Closed position detection completed', {
        activeBuyPositions: activeBuyTrades.length,
        sellOrdersAnalyzed: sellOrders.length,
        positionsClosed: closedCount
      });

    } catch (error) {
      console.error('❌ Error during closed position detection:', error);
      await this.logger.logError('Closed position detection failed', error);
    }
  }

  private async getRecentSellOrders(): Promise<any[]> {
    try {
      // Get order history from Bybit (last 7 days)
      const response = await this.bybitService.getOrderHistory(200);
      
      if (response.retCode !== 0 || !response.result?.list) {
        console.error('Failed to fetch order history from Bybit');
        return [];
      }

      // Filter for sell orders that are filled
      const sellOrders = response.result.list.filter((order: any) => 
        order.side === 'Sell' && 
        order.orderStatus === 'Filled'
      );

      console.log(`📊 Filtered to ${sellOrders.length} filled sell orders`);
      return sellOrders;
    } catch (error) {
      console.error('❌ Error fetching sell orders:', error);
      return [];
    }
  }

  private async checkIfPositionWasClosed(buyTrade: any, sellOrders: any[]): Promise<boolean> {
    try {
      // Look for sell orders that match this buy position
      const matchingSellOrders = sellOrders.filter(sellOrder => {
        // Match by symbol
        if (sellOrder.symbol !== buyTrade.symbol) return false;
        
        // Match by quantity (with tolerance)
        const quantityMatch = Math.abs(parseFloat(sellOrder.qty) - buyTrade.quantity) < buyTrade.quantity * 0.05; // 5% tolerance
        
        // Make sure sell order is after buy order
        const sellTime = parseInt(sellOrder.updatedTime || sellOrder.createdTime);
        const buyTime = new Date(buyTrade.created_at).getTime();
        const timeOrder = sellTime > buyTime;
        
        return quantityMatch && timeOrder;
      });

      if (matchingSellOrders.length === 0) {
        return false; // No matching sell order found
      }

      // Find the most likely matching sell order (closest quantity match)
      const bestMatch = matchingSellOrders.reduce((best, current) => {
        const bestQuantityDiff = Math.abs(parseFloat(best.qty) - buyTrade.quantity);
        const currentQuantityDiff = Math.abs(parseFloat(current.qty) - buyTrade.quantity);
        return currentQuantityDiff < bestQuantityDiff ? current : best;
      });

      console.log(`🎯 Found matching sell order for ${buyTrade.symbol}: ${bestMatch.orderId}`);

      // Calculate P&L
      const buyPrice = buyTrade.buy_fill_price || buyTrade.price;
      const sellPrice = parseFloat(bestMatch.avgPrice || bestMatch.price);
      const quantity = parseFloat(bestMatch.qty);
      const profitLoss = (sellPrice - buyPrice) * quantity;

      // Mark the position as closed
      await this.markPositionAsClosed(buyTrade, bestMatch, profitLoss);
      
      return true;
    } catch (error) {
      console.error(`❌ Error checking position closure for ${buyTrade.symbol}:`, error);
      return false;
    }
  }

  private async markPositionAsClosed(buyTrade: any, sellOrder: any, profitLoss: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('trades')
        .update({
          status: 'closed',
          profit_loss: profitLoss,
          updated_at: new Date().toISOString()
        })
        .eq('id', buyTrade.id)
        .eq('status', 'filled'); // Only update if still marked as filled

      if (error) {
        console.error(`❌ Error marking trade ${buyTrade.id} as closed:`, error);
        return;
      }

      console.log(`✅ Marked ${buyTrade.symbol} position as closed with P&L: $${profitLoss.toFixed(2)}`);
      
      await this.logger.log('position_closed', `Auto-closed ${buyTrade.symbol} position via sell order detection`, {
        tradeId: buyTrade.id,
        symbol: buyTrade.symbol,
        buyOrderId: buyTrade.bybit_order_id,
        sellOrderId: sellOrder.orderId,
        profitLoss,
        buyPrice: buyTrade.buy_fill_price || buyTrade.price,
        sellPrice: parseFloat(sellOrder.avgPrice || sellOrder.price),
        quantity: parseFloat(sellOrder.qty)
      });

    } catch (error) {
      console.error(`❌ Error marking position as closed:`, error);
    }
  }

  /**
   * Detect positions that should be closed based on account balance
   */
  async detectClosedPositionsByBalance(): Promise<void> {
    try {
      console.log('💰 Checking account balance to detect closed positions...');
      
      // Get current account balance
      const balanceResponse = await this.bybitService.getAccountBalance();
      const balanceMap = new Map<string, number>();

      if (balanceResponse.retCode === 0 && balanceResponse.result?.list?.[0]?.coin) {
        balanceResponse.result.list[0].coin.forEach((coin: any) => {
          const balance = parseFloat(coin.walletBalance || '0');
          if (balance > 0) {
            balanceMap.set(coin.coin, balance);
          }
        });
      }

      console.log(`💰 Current non-zero balances: ${Array.from(balanceMap.entries()).map(([coin, balance]) => `${coin}: ${balance}`).join(', ')}`);

      // Get active filled buy positions
      const { data: activeBuyPositions } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('side', 'buy')
        .eq('status', 'filled');

      if (!activeBuyPositions || activeBuyPositions.length === 0) {
        return;
      }

      let closedByBalanceCount = 0;

      for (const position of activeBuyPositions) {
        const baseAsset = position.symbol.replace('USDT', '');
        const currentBalance = balanceMap.get(baseAsset) || 0;

        // If we have no balance for this asset, the position is likely closed
        if (currentBalance === 0) {
          console.log(`💰 No balance found for ${baseAsset}, marking ${position.symbol} position as closed`);
          
          const { error } = await supabase
            .from('trades')
            .update({
              status: 'closed',
              profit_loss: 0, // Unknown P&L when closing by balance
              updated_at: new Date().toISOString()
            })
            .eq('id', position.id)
            .eq('status', 'filled');

          if (!error) {
            closedByBalanceCount++;
            await this.logger.log('position_closed', `Auto-closed ${position.symbol} position due to zero balance`, {
              tradeId: position.id,
              symbol: position.symbol,
              reason: 'zero_balance',
              baseAsset
            });
          }
        }
      }

      if (closedByBalanceCount > 0) {
        console.log(`✅ Closed ${closedByBalanceCount} positions based on zero balance`);
      }

    } catch (error) {
      console.error('❌ Error detecting closed positions by balance:', error);
    }
  }
}