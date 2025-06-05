
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class EndOfDayManagerService {
  private userId: string;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
  }

  async manageEndOfDay(config: TradingConfigData, forceSimulation: boolean = false): Promise<void> {
    try {
      if (!config.auto_close_at_end_of_day && !forceSimulation) {
        console.log('⏸️ End-of-day auto-close is disabled');
        return;
      }

      console.log('🌅 Checking end-of-day management...');

      // Check if we're near end of day (for now, just check if it's past 22:00 UTC)
      const currentHour = new Date().getUTCHours();
      const isEndOfDay = currentHour >= 22; // 10 PM UTC

      // For manual simulation, always proceed regardless of time
      if (!isEndOfDay && !forceSimulation) {
        console.log(`⏰ Not end of day yet (current hour: ${currentHour} UTC)`);
        return;
      }

      if (forceSimulation) {
        console.log('🔄 MANUAL EOD SIMULATION - Processing all positions regardless of time');
        await this.logActivity('system_info', 'Manual EOD simulation started');
      } else {
        console.log('🌅 End of day detected, checking positions to close...');
        await this.logActivity('system_info', 'Automatic EOD process started');
      }

      // Get all active positions
      const { data: activeTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .in('status', ['filled', 'partial_filled']);

      if (error) {
        console.error('❌ Error fetching active trades:', error);
        await this.logActivity('system_error', 'Error fetching active trades for EOD', { error: error.message });
        return;
      }

      if (!activeTrades || activeTrades.length === 0) {
        console.log('📭 No active positions to close');
        await this.logActivity('system_info', 'No active positions found for EOD closure');
        return;
      }

      console.log(`📊 Found ${activeTrades.length} active positions to evaluate for EOD closure`);

      for (const trade of activeTrades) {
        await this.evaluateTradeForEODClosure(trade, config, forceSimulation);
      }

      console.log('✅ End-of-day management completed');
      await this.logActivity('system_info', 'End-of-day management completed successfully');
    } catch (error) {
      console.error('❌ Error in end-of-day management:', error);
      await this.logActivity('system_error', 'Error in end-of-day management', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        forceSimulation 
      });
      throw error;
    }
  }

  private async evaluateTradeForEODClosure(trade: any, config: TradingConfigData, forceSimulation: boolean = false): Promise<void> {
    try {
      console.log(`🔍 Evaluating ${trade.symbol} for EOD closure...`);

      // Get current market price
      const marketPrice = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketPrice.price;
      const entryPrice = parseFloat(trade.price.toString());

      // Calculate current P&L percentage
      const plPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;
      
      console.log(`  Entry: $${entryPrice.toFixed(4)}, Current: $${currentPrice.toFixed(4)}, P&L: ${plPercentage.toFixed(2)}%`);

      // For manual simulation, close if profitable (above 0%)
      // For regular EOD, close if below the threshold
      let shouldClose = false;
      if (forceSimulation) {
        shouldClose = plPercentage > 0; // Close profitable positions in simulation
        console.log(`  Manual simulation: ${shouldClose ? 'CLOSING' : 'KEEPING'} (profit threshold: 0%)`);
      } else {
        shouldClose = plPercentage < config.eod_close_premium_percent;
        console.log(`  Regular EOD: ${shouldClose ? 'CLOSING' : 'KEEPING'} (threshold: ${config.eod_close_premium_percent}%)`);
      }
      
      if (shouldClose) {
        const reason = forceSimulation ? 'manual_eod_simulation' : 'eod_auto_close';
        console.log(`🔄 Closing position for ${reason}: ${trade.symbol} (P&L: ${plPercentage.toFixed(2)}%)`);
        await this.closePosition(trade, currentPrice, reason);
      } else {
        const threshold = forceSimulation ? '0%' : `${config.eod_close_premium_percent}%`;
        console.log(`✅ Keeping position open: ${trade.symbol} (P&L ${forceSimulation ? 'not above' : 'above'} ${threshold})`);
      }

    } catch (error) {
      console.error(`❌ Error evaluating trade ${trade.id} for EOD closure:`, error);
      await this.logActivity('system_error', `Error evaluating trade for EOD closure: ${trade.symbol}`, {
        tradeId: trade.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async closePosition(trade: any, closePrice: number, reason: string): Promise<void> {
    try {
      // Place market sell order
      const sellQuantity = parseFloat(trade.quantity.toString());
      
      console.log(`📤 Placing market sell order for ${trade.symbol}: ${sellQuantity} at market price`);

      const sellOrder = await this.bybitService.placeOrder({
        symbol: trade.symbol,
        side: 'Sell',
        orderType: 'Market',
        qty: sellQuantity.toString(),
      });

      if (sellOrder.orderId) {
        // Calculate final P&L
        const entryPrice = parseFloat(trade.price.toString());
        const profitLoss = (closePrice - entryPrice) * sellQuantity;
        
        // Update trade in database
        const { error } = await supabase
          .from('trades')
          .update({
            status: 'closed',
            profit_loss: profitLoss,
            updated_at: new Date().toISOString()
          })
          .eq('id', trade.id);

        if (error) {
          console.error(`❌ Error updating closed trade ${trade.id}:`, error);
          await this.logActivity('system_error', `Error updating closed trade: ${trade.symbol}`, {
            tradeId: trade.id,
            error: error.message
          });
        } else {
          console.log(`✅ Position closed: ${trade.symbol}, P&L: $${profitLoss.toFixed(2)}`);
          await this.logActivity('position_closed', `${reason}: ${trade.symbol}`, {
            tradeId: trade.id,
            symbol: trade.symbol,
            entryPrice,
            closePrice,
            profitLoss,
            reason
          });
        }
      } else {
        throw new Error('Failed to place sell order - no order ID returned');
      }

    } catch (error) {
      console.error(`❌ Error closing position for trade ${trade.id}:`, error);
      await this.logActivity('system_error', `Failed to close position: ${trade.symbol}`, {
        tradeId: trade.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      // Valid log types based on database constraints
      const validLogTypes = [
        'signal_processed',
        'trade_executed', 
        'trade_filled',
        'position_closed',
        'system_error',
        'order_placed',
        'order_failed',
        'calculation_error',
        'execution_error',
        'signal_rejected',
        'order_rejected'
      ];

      // Map any custom types to valid ones
      const typeMapping: Record<string, string> = {
        'system_info': 'signal_processed', // Use signal_processed for general info
        'eod_started': 'signal_processed',
        'eod_completed': 'position_closed',
        'manual_close': 'position_closed',
        'close_error': 'execution_error'
      };

      const validType = typeMapping[type] || (validLogTypes.includes(type) ? type : 'system_error');

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
