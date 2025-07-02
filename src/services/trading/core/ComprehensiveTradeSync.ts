import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { TradeRecorder } from './TradeRecorder';

export class ComprehensiveTradeSync {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private tradeRecorder: TradeRecorder;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.tradeRecorder = new TradeRecorder(userId);
  }

  /**
   * EMERGENCY SYNC: Pull all recent Bybit orders and create missing trade records
   */
  async emergencyFullSync(): Promise<void> {
    try {
      console.log('🚨 ===== EMERGENCY COMPREHENSIVE TRADE SYNC =====');
      await this.logger.logSystemInfo('Starting emergency comprehensive trade sync');

      // Get recent Bybit order history (last 7 days)
      const orderHistory = await this.getBybitOrderHistory(7 * 24); // 7 days in hours
      
      if (!orderHistory || orderHistory.length === 0) {
        console.log('📭 No recent orders found on Bybit');
        return;
      }

      console.log(`📊 Found ${orderHistory.length} orders on Bybit to process`);

      // Get existing trade records to avoid duplicates
      const { data: existingTrades } = await supabase
        .from('trades')
        .select('bybit_order_id, symbol, side, status')
        .eq('user_id', this.userId)
        .not('bybit_order_id', 'is', null);

      const existingOrderIds = new Set(existingTrades?.map(t => t.bybit_order_id) || []);
      console.log(`📋 Found ${existingOrderIds.size} existing trade records in database`);

      let createdCount = 0;
      let updatedCount = 0;

      // Process each Bybit order
      for (const order of orderHistory) {
        try {
          if (existingOrderIds.has(order.orderId)) {
            // Update existing record if needed
            const updated = await this.updateExistingTradeFromBybit(order);
            if (updated) updatedCount++;
          } else {
            // Create new record for missing order
            const created = await this.createTradeFromBybitOrder(order);
            if (created) createdCount++;
          }
        } catch (error) {
          console.error(`❌ Error processing order ${order.orderId}:`, error);
        }
      }

      console.log(`✅ Emergency sync complete: ${createdCount} trades created, ${updatedCount} trades updated`);
      
      await this.logger.logSuccess('Emergency sync completed', {
        totalBybitOrders: orderHistory.length,
        existingTrades: existingOrderIds.size,
        tradesCreated: createdCount,
        tradesUpdated: updatedCount
      });

    } catch (error) {
      console.error('❌ Emergency sync failed:', error);
      await this.logger.logError('Emergency sync failed', error);
      throw error;
    }
  }

  private async getBybitOrderHistory(lookbackHours: number): Promise<any[]> {
    try {
      const response = await this.bybitService.getOrderHistory(200); // Get more orders
      
      if (response.retCode !== 0 || !response.result?.list) {
        throw new Error(`Failed to fetch order history: ${response.retMsg}`);
      }

      const cutoffTime = Date.now() - (lookbackHours * 60 * 60 * 1000);
      
      // Filter orders by time and only include filled ones
      const recentOrders = response.result.list.filter((order: any) => {
        const orderTime = parseInt(order.updatedTime || order.createdTime);
        return orderTime >= cutoffTime && order.orderStatus === 'Filled';
      });

      console.log(`📊 Filtered to ${recentOrders.length} recent filled orders`);
      return recentOrders;
    } catch (error) {
      console.error('❌ Error fetching Bybit order history:', error);
      throw error;
    }
  }

  private async createTradeFromBybitOrder(order: any): Promise<boolean> {
    try {
      console.log(`📝 Creating missing trade record for ${order.symbol} order ${order.orderId}`);

      const tradeData = {
        user_id: this.userId,
        symbol: order.symbol,
        side: order.side.toLowerCase(),
        order_type: order.orderType.toLowerCase() === 'market' ? 'market' : 'limit',
        price: parseFloat(order.avgPrice || order.price),
        quantity: parseFloat(order.qty),
        status: 'filled', // Since we're only processing filled orders
        bybit_order_id: order.orderId,
        bybit_trade_id: order.orderId,
        created_at: new Date(parseInt(order.createdTime)).toISOString(),
        updated_at: new Date(parseInt(order.updatedTime)).toISOString()
      };

      // Add fill price for buy orders
      if (order.side.toLowerCase() === 'buy' && order.avgPrice) {
        (tradeData as any).buy_fill_price = parseFloat(order.avgPrice);
      }

      const { data, error } = await supabase
        .from('trades')
        .insert(tradeData)
        .select()
        .single();

      if (error) {
        console.error(`❌ Error creating trade for order ${order.orderId}:`, error);
        return false;
      }

      console.log(`✅ Created trade record ${data.id} for ${order.symbol}`);
      
      await this.logger.log('trade_created_from_sync', `Created missing trade record for ${order.symbol}`, {
        tradeId: data.id,
        bybitOrderId: order.orderId,
        symbol: order.symbol,
        side: order.side,
        source: 'emergency_sync'
      });

      return true;
    } catch (error) {
      console.error(`❌ Error creating trade from Bybit order:`, error);
      return false;
    }
  }

  private async updateExistingTradeFromBybit(order: any): Promise<boolean> {
    try {
      const { data: existingTrade } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('bybit_order_id', order.orderId)
        .single();

      if (!existingTrade) return false;

      // Check if update is needed
      const needsUpdate = 
        existingTrade.status !== 'filled' ||
        Math.abs(existingTrade.price - parseFloat(order.avgPrice || order.price)) > 0.000001 ||
        Math.abs(existingTrade.quantity - parseFloat(order.qty)) > 0.000001;

      if (!needsUpdate) return false;

      const updateData: any = {
        status: 'filled',
        price: parseFloat(order.avgPrice || order.price),
        quantity: parseFloat(order.qty),
        updated_at: new Date().toISOString()
      };

      // Add fill price for buy orders
      if (order.side.toLowerCase() === 'buy' && order.avgPrice) {
        updateData.buy_fill_price = parseFloat(order.avgPrice);
      }

      const { error } = await supabase
        .from('trades')
        .update(updateData)
        .eq('id', existingTrade.id);

      if (error) {
        console.error(`❌ Error updating trade ${existingTrade.id}:`, error);
        return false;
      }

      console.log(`✅ Updated trade ${existingTrade.id} from Bybit data`);
      return true;
    } catch (error) {
      console.error('❌ Error updating existing trade:', error);
      return false;
    }
  }

  /**
   * Fix position validator by ensuring it uses correct database queries
   */
  async validatePositionLimitsWithRealData(symbol: string, maxPositionsPerPair: number): Promise<{
    isValid: boolean;
    currentCount: number;
    reason?: string;
  }> {
    try {
      // Get REAL count of active positions for this symbol
      const { count } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('side', 'buy') // Only count buy orders
        .in('status', ['pending', 'filled', 'partial_filled']);

      const currentCount = count || 0;
      
      console.log(`🔍 POSITION VALIDATION: ${symbol} has ${currentCount}/${maxPositionsPerPair} active buy positions`);

      if (currentCount >= maxPositionsPerPair) {
        return {
          isValid: false,
          currentCount,
          reason: `Maximum positions per pair exceeded: ${currentCount}/${maxPositionsPerPair}`
        };
      }

      return {
        isValid: true,
        currentCount
      };
    } catch (error) {
      console.error(`❌ Error validating position limits for ${symbol}:`, error);
      return {
        isValid: false,
        currentCount: 0,
        reason: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * Perform startup sync to ensure database consistency
   */
  async performStartupSync(): Promise<void> {
    console.log('🚀 Performing comprehensive startup sync...');
    
    // Run emergency sync to catch up missing trades
    await this.emergencyFullSync();
    
    // Then run regular position sync
    const { PositionSyncService } = await import('./PositionSyncService');
    const positionSync = new PositionSyncService(this.userId, this.bybitService);
    await positionSync.performStartupSync();
    
    console.log('✅ Startup sync completed');
  }
}