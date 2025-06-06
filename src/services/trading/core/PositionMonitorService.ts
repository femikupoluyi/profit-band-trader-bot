
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';
import { OrderPlacer } from './OrderPlacer';

export class PositionMonitorService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private orderPlacer: OrderPlacer;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.bybitService.setLogger(this.logger);
    this.orderPlacer = new OrderPlacer(userId, bybitService);
  }

  async checkOrderFills(config: TradingConfigData): Promise<void> {
    try {
      console.log('📊 Checking order fills with guaranteed take-profit creation...');
      
      // Get pending buy orders from database
      const { data: pendingBuyTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('side', 'buy')
        .eq('status', 'pending');

      if (error) {
        console.error('❌ Error fetching pending buy trades:', error);
        await this.logger.logError('Error fetching pending buy trades', error);
        return;
      }

      if (!pendingBuyTrades || pendingBuyTrades.length === 0) {
        console.log('📭 No pending buy orders to check');
        return;
      }

      console.log(`📋 Found ${pendingBuyTrades.length} pending buy orders to check for fills`);
      await this.logger.logSuccess(`Found ${pendingBuyTrades.length} pending buy orders to check`);

      for (const trade of pendingBuyTrades) {
        await this.checkSingleOrderFill(trade, config);
      }

      console.log('✅ Order fill check completed with guaranteed take-profit logic');
      await this.logger.logSuccess('Order fill check completed');
    } catch (error) {
      console.error('❌ Error checking order fills:', error);
      await this.logger.logError('Error checking order fills', error);
      throw error;
    }
  }

  private async checkSingleOrderFill(trade: any, config: TradingConfigData): Promise<void> {
    try {
      if (!trade.bybit_order_id) {
        console.log(`⚠️ Trade ${trade.id} has no Bybit order ID, skipping`);
        return;
      }

      console.log(`🔍 Checking buy order ${trade.bybit_order_id} for ${trade.symbol}`);

      // Get order status from Bybit
      const orderStatus = await this.bybitService.getOrderStatus(trade.bybit_order_id);
      
      if (orderStatus && orderStatus.retCode === 0 && orderStatus.result?.list?.length > 0) {
        const order = orderStatus.result.list[0];
        
        if (order.orderStatus === 'Filled') {
          console.log(`✅ Buy order ${trade.bybit_order_id} is filled - creating guaranteed take-profit`);
          
          // Update trade status in database to 'filled'
          const { error: updateError } = await supabase
            .from('trades')
            .update({ 
              status: 'filled',
              updated_at: new Date().toISOString()
            })
            .eq('id', trade.id);

          if (updateError) {
            console.error(`❌ Error updating trade ${trade.id}:`, updateError);
            await this.logger.logError(`Error updating trade ${trade.id}`, updateError, {
              tradeId: trade.id
            });
            return;
          }

          console.log(`✅ Updated trade ${trade.id} status to filled`);
          await this.logger.log('trade_filled', `Buy order filled for ${trade.symbol}`, {
            tradeId: trade.id,
            symbol: trade.symbol,
            bybitOrderId: trade.bybit_order_id,
            entryPrice: trade.price,
            quantity: trade.quantity
          });

          // GUARANTEED: Create take-profit order immediately after fill confirmation
          try {
            console.log(`🎯 GUARANTEED: Creating take-profit order for filled buy ${trade.symbol}`);
            await this.orderPlacer.createTakeProfitOrder(trade, config.take_profit_percent);
            console.log(`✅ GUARANTEED: Take-profit order created successfully for ${trade.symbol}`);
            
            await this.logger.log('order_placed', `Guaranteed take-profit created for ${trade.symbol}`, {
              tradeId: trade.id,
              symbol: trade.symbol,
              entryPrice: trade.price,
              takeProfitPercent: config.take_profit_percent,
              method: 'guaranteed_on_fill'
            });
          } catch (tpError) {
            console.error(`❌ CRITICAL: Failed to create guaranteed take-profit for ${trade.symbol}:`, tpError);
            await this.logger.logError(`CRITICAL: Failed to create guaranteed take-profit`, tpError, {
              tradeId: trade.id,
              symbol: trade.symbol,
              entryPrice: trade.price,
              severity: 'CRITICAL',
              action: 'MANUAL_INTERVENTION_REQUIRED'
            });
            
            // This is critical - we must not let filled buys exist without take-profit orders
            throw new Error(`CRITICAL: Failed to create take-profit for filled buy ${trade.symbol}`);
          }
        } else {
          console.log(`⏳ Buy order ${trade.bybit_order_id} status: ${order.orderStatus}`);
        }
      } else {
        console.log(`⚠️ Invalid response for order ${trade.bybit_order_id}:`, orderStatus);
      }

    } catch (error) {
      console.error(`❌ Error checking buy order ${trade.bybit_order_id}:`, error);
      await this.logger.logError(`Failed to check buy order status`, error, {
        tradeId: trade.id,
        bybitOrderId: trade.bybit_order_id
      });
      throw error; // Re-throw to ensure this error is handled upstream
    }
  }

  // Additional method to audit existing filled buys without take-profit orders
  async auditMissingTakeProfitOrders(config: TradingConfigData): Promise<void> {
    try {
      console.log('🔍 Auditing filled buy orders for missing take-profit orders...');
      
      // Get all filled buy orders
      const { data: filledBuys, error: filledError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('side', 'buy')
        .eq('status', 'filled');

      if (filledError) {
        console.error('❌ Error fetching filled buy orders:', filledError);
        return;
      }

      if (!filledBuys || filledBuys.length === 0) {
        console.log('📭 No filled buy orders found');
        return;
      }

      console.log(`📋 Found ${filledBuys.length} filled buy orders to audit`);

      for (const buyTrade of filledBuys) {
        // Check if corresponding take-profit sell order exists
        const { data: sellOrders, error: sellError } = await supabase
          .from('trades')
          .select('*')
          .eq('user_id', this.userId)
          .eq('side', 'sell')
          .eq('symbol', buyTrade.symbol)
          .in('status', ['pending', 'filled']);

        if (sellError) {
          console.error(`❌ Error checking sell orders for ${buyTrade.symbol}:`, sellError);
          continue;
        }

        // If no pending/filled sell order exists, create take-profit order
        if (!sellOrders || sellOrders.length === 0) {
          console.log(`⚠️ MISSING TAKE-PROFIT: Found filled buy ${buyTrade.symbol} without corresponding sell order`);
          
          try {
            await this.orderPlacer.createTakeProfitOrder(buyTrade, config.take_profit_percent);
            console.log(`✅ RECOVERY: Created missing take-profit order for ${buyTrade.symbol}`);
            
            await this.logger.log('order_placed', `Recovery take-profit created for ${buyTrade.symbol}`, {
              tradeId: buyTrade.id,
              symbol: buyTrade.symbol,
              entryPrice: buyTrade.price,
              takeProfitPercent: config.take_profit_percent,
              method: 'recovery_audit'
            });
          } catch (recoveryError) {
            console.error(`❌ CRITICAL: Failed to create recovery take-profit for ${buyTrade.symbol}:`, recoveryError);
            await this.logger.logError(`CRITICAL: Failed to create recovery take-profit`, recoveryError, {
              tradeId: buyTrade.id,
              symbol: buyTrade.symbol,
              severity: 'CRITICAL'
            });
          }
        }
      }

      console.log('✅ Take-profit audit completed');
    } catch (error) {
      console.error('❌ Error during take-profit audit:', error);
      await this.logger.logError('Take-profit audit failed', error);
    }
  }
}
