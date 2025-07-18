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
    return this.emergencyFullSyncWithTimeRange(72); // Default 72 hours
  }

  /**
   * EMERGENCY SYNC with specific time range: Pull Bybit orders within time range
   */
  async emergencyFullSyncWithTimeRange(lookbackHours: number): Promise<void> {
    try {
      console.log('🚨 ===== EMERGENCY COMPREHENSIVE TRADE SYNC =====');
      console.log(`🔍 CRITICAL: Starting sync with lookback: ${lookbackHours} hours`);
      await this.logger.logSystemInfo('Starting emergency comprehensive trade sync');

      // CRITICAL: First get all active orders (not just history)
      console.log('📊 CRITICAL: Fetching ALL active orders from Bybit...');
      const activeOrders = await this.getActiveOrdersFromBybit();
      console.log(`📊 CRITICAL: Retrieved ${activeOrders.length} active orders from Bybit`);
      
      // Then get recent order history based on lookback period
      const orderHistory = await this.getBybitOrderHistory(lookbackHours);
      
      // Combine active orders and recent history
      const allOrders = [...activeOrders, ...orderHistory];
      
      // Remove duplicates based on orderId
      const uniqueOrders = allOrders.filter((order, index, self) =>
        index === self.findIndex(o => o.orderId === order.orderId)
      );
      
      if (!uniqueOrders || uniqueOrders.length === 0) {
        console.log('📭 No orders found on Bybit');
        return;
      }

      console.log(`📊 Found ${uniqueOrders.length} total orders on Bybit to process (${activeOrders.length} active, ${orderHistory.length} historical)`);

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
      for (const order of uniqueOrders) {
        try {
          if (existingOrderIds.has(order.orderId)) {
            // Update existing record if needed
            const updated = await this.updateExistingTradeFromBybit(order);
            if (updated) updatedCount++;
          } else {
            // Create new record for missing order - include ALL orders that aren't cancelled/rejected
            if (!['Cancelled', 'Rejected', 'Deactivated'].includes(order.orderStatus)) {
              const created = await this.createTradeFromBybitOrder(order);
              if (created) createdCount++;
            }
          }
        } catch (error) {
          console.error(`❌ Error processing order ${order.orderId}:`, error);
        }
      }

      // CRITICAL: Detect and mark closed positions
      console.log('🔍 Starting closed position detection...');
      const { ClosedPositionDetector } = await import('./ClosedPositionDetector');
      const closedPositionDetector = new ClosedPositionDetector(this.userId, this.bybitService);
      
      // First detect by sell order matching
      await closedPositionDetector.detectAndMarkClosedPositions();
      
      // Then detect by account balance
      await closedPositionDetector.detectClosedPositionsByBalance();

      console.log(`✅ Emergency sync complete: ${createdCount} trades created, ${updatedCount} trades updated + closed position detection`);
      
      await this.logger.logSuccess('Emergency sync completed with closed position detection', {
        totalBybitOrders: uniqueOrders.length,
        activeOrders: activeOrders.length,
        historicalOrders: orderHistory.length,
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

  /**
   * Get active orders from Bybit (not just order history)
   */
  private async getActiveOrdersFromBybit(): Promise<any[]> {
    try {
      console.log('📋 CRITICAL: Fetching active orders from Bybit...');
      
      // Get active orders using the order status API
      const response = await this.bybitService.getActiveOrders();
      console.log('📋 CRITICAL: Raw response from getActiveOrders:', response);
      
      if (response.retCode !== 0 || !response.result?.list) {
        console.log(`⚠️ CRITICAL: Failed to fetch active orders: ${response.retMsg}`);
        console.log(`⚠️ CRITICAL: Full response:`, response);
        return [];
      }

      const activeOrders = response.result.list || [];
      console.log(`📊 CRITICAL: Found ${activeOrders.length} active orders on Bybit`);
      console.log(`📊 CRITICAL: Active orders details:`, activeOrders.map(o => `${o.symbol} ${o.side} ${o.qty} @ ${o.price} (${o.orderStatus})`));
      
      return activeOrders;
    } catch (error) {
      console.error('❌ CRITICAL: Error fetching active orders from Bybit:', error);
      return [];
    }
  }

  private async getBybitOrderHistory(lookbackHours: number): Promise<any[]> {
    try {
      const response = await this.bybitService.getOrderHistory(200); // Get more orders
      
      if (response.retCode !== 0 || !response.result?.list) {
        throw new Error(`Failed to fetch order history: ${response.retMsg}`);
      }

      const cutoffTime = Date.now() - (lookbackHours * 60 * 60 * 1000);
      
      // Filter orders by time - include ALL order statuses to detect closed positions
      const recentOrders = response.result.list.filter((order: any) => {
        const orderTime = parseInt(order.updatedTime || order.createdTime);
        return orderTime >= cutoffTime;
      });

      console.log(`📊 Filtered to ${recentOrders.length} recent orders (all statuses)`);
      return recentOrders;
    } catch (error) {
      console.error('❌ Error fetching Bybit order history:', error);
      throw error;
    }
  }

  private async createTradeFromBybitOrder(order: any): Promise<boolean> {
    try {
      console.log(`📝 Creating missing trade record for ${order.symbol} order ${order.orderId}`);

      // CRITICAL: Map Bybit order status to bot status with proper active order handling
      let botStatus = 'pending';
      
      console.log(`🔍 CRITICAL: Mapping status for order ${order.orderId} - Bybit status: ${order.orderStatus}`);
      
      // CRITICAL: Handle active orders from /v5/order/realtime first
      if (order.orderStatus === 'New' || order.orderStatus === 'Untriggered' || order.orderStatus === 'PartiallyFilled') {
        // These are definitely active/pending orders
        botStatus = order.orderStatus === 'PartiallyFilled' ? 'partial_filled' : 'pending';
        console.log(`✅ CRITICAL: Active order ${order.orderId} mapped to '${botStatus}'`);
      } else if (order.orderStatus === 'Filled') {
        botStatus = 'filled';
        console.log(`✅ CRITICAL: Filled order ${order.orderId} mapped to 'filled'`);
      } else if (['Cancelled', 'Rejected', 'Deactivated'].includes(order.orderStatus)) {
        botStatus = 'closed';
        console.log(`✅ CRITICAL: Cancelled order ${order.orderId} mapped to 'closed'`);
      } else {
        // Default for unknown statuses - log for investigation
        console.log(`⚠️ CRITICAL: Unknown order status '${order.orderStatus}' for order ${order.orderId}, defaulting to 'pending'`);
        botStatus = 'pending';
      }

      // CRITICAL: Validate price to avoid database constraint violations
      const orderPrice = parseFloat(order.avgPrice || order.price);
      const orderQty = parseFloat(order.qty);
      
      console.log(`🔍 CRITICAL: Processing order ${order.orderId} - Symbol: ${order.symbol}, Price: ${orderPrice}, Qty: ${orderQty}, Status: ${order.orderStatus}`);
      
      if (orderPrice <= 0 || isNaN(orderPrice)) {
        console.log(`⚠️ SKIPPING order ${order.orderId} - Invalid price: ${orderPrice}`);
        return false;
      }
      
      if (orderQty <= 0 || isNaN(orderQty)) {
        console.log(`⚠️ SKIPPING order ${order.orderId} - Invalid quantity: ${orderQty}`);
        return false;
      }

      const tradeData = {
        user_id: this.userId,
        symbol: order.symbol,
        side: order.side.toLowerCase(),
        order_type: order.orderType.toLowerCase() === 'market' ? 'market' : 'limit',
        price: orderPrice,
        quantity: orderQty,
        status: botStatus,
        bybit_order_id: order.orderId,
        bybit_trade_id: order.orderId,
        created_at: new Date(parseInt(order.createdTime)).toISOString(),
        updated_at: new Date(parseInt(order.updatedTime)).toISOString()
      };
      
      console.log(`📝 CRITICAL: About to insert trade:`, tradeData);

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
        console.error(`❌ CRITICAL: Error creating trade for order ${order.orderId}:`, error);
        console.error(`❌ CRITICAL: Failed trade data:`, tradeData);
        console.error(`❌ CRITICAL: Database error details:`, error.details, error.hint, error.code);
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

      // Check if update is needed - handle all order status changes
      const bybitStatus = order.orderStatus;
      const shouldBeClosed = ['Cancelled', 'Rejected', 'Deactivated'].includes(bybitStatus);
      const shouldBeFilled = bybitStatus === 'Filled';
      const shouldBePartialFilled = bybitStatus === 'PartiallyFilled';
      const shouldBePending = bybitStatus === 'New';
      
      const needsUpdate = 
        (shouldBeClosed && existingTrade.status !== 'closed') ||
        (shouldBeFilled && existingTrade.status !== 'filled') ||
        (shouldBePartialFilled && existingTrade.status !== 'partial_filled') ||
        (shouldBePending && existingTrade.status !== 'pending') ||
        (shouldBeFilled && Math.abs(existingTrade.price - parseFloat(order.avgPrice || order.price)) > 0.000001) ||
        (shouldBeFilled && Math.abs(existingTrade.quantity - parseFloat(order.qty)) > 0.000001);

      if (!needsUpdate) return false;

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      // CRITICAL: Handle different order statuses - preserve active orders properly
      console.log(`🔍 CRITICAL: Updating trade ${existingTrade.id} from '${existingTrade.status}' based on Bybit status '${bybitStatus}'`);
      
      if (shouldBeClosed) {
        // ONLY close if the order was actually cancelled/rejected on Bybit
        updateData.status = 'closed';
        console.log(`🔄 CRITICAL: Marking trade ${existingTrade.id} as CLOSED due to Bybit cancellation: ${bybitStatus}`);
      } else if (shouldBeFilled) {
        // For filled orders, keep them as 'filled' (active positions)
        updateData.status = 'filled';
        updateData.price = parseFloat(order.avgPrice || order.price);
        updateData.quantity = parseFloat(order.qty);
        
        // Add fill price for buy orders
        if (order.side.toLowerCase() === 'buy' && order.avgPrice) {
          updateData.buy_fill_price = parseFloat(order.avgPrice);
        }
        console.log(`✅ CRITICAL: Updating trade ${existingTrade.id} to FILLED (active position)`);
      } else if (shouldBePartialFilled) {
        updateData.status = 'partial_filled';
        updateData.price = parseFloat(order.avgPrice || order.price);
        updateData.quantity = parseFloat(order.qty);
        
        // Add fill price for buy orders
        if (order.side.toLowerCase() === 'buy' && order.avgPrice) {
          updateData.buy_fill_price = parseFloat(order.avgPrice);
        }
        console.log(`✅ CRITICAL: Updating trade ${existingTrade.id} to PARTIAL_FILLED`);
      } else if (shouldBePending) {
        updateData.status = 'pending';
        console.log(`✅ CRITICAL: Keeping/updating trade ${existingTrade.id} as PENDING (active order)`);
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
    
    // DO NOT run aggressive position sync that closes trades
    // Only run sync if explicitly requested by user
    console.log('⚠️ Skipping aggressive position sync to prevent incorrect trade closures');
    
    console.log('✅ Startup sync completed (conservative mode)');
  }
}