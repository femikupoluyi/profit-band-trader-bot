
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

      // Log the start of EOD process
      await this.logActivity('signal_processed', forceSimulation ? 'Manual EOD simulation started' : 'Automatic EOD process started', {
        forceSimulation,
        autoCloseEnabled: config.auto_close_at_end_of_day,
        eodThreshold: config.eod_close_premium_percent,
        action: 'eod_start'
      });

      // Check if we're near end of day (for now, just check if it's past 22:00 UTC)
      const currentHour = new Date().getUTCHours();
      const isEndOfDay = currentHour >= 22; // 10 PM UTC

      // For manual simulation, always proceed regardless of time
      if (!isEndOfDay && !forceSimulation) {
        console.log(`⏰ Not end of day yet (current hour: ${currentHour} UTC)`);
        await this.logActivity('signal_processed', `Not end of day yet (current hour: ${currentHour} UTC)`, {
          currentHour,
          action: 'eod_not_time'
        });
        return;
      }

      if (forceSimulation) {
        console.log('🔄 MANUAL EOD SIMULATION - Processing all positions regardless of time');
        await this.logActivity('signal_processed', 'Manual EOD simulation - processing all positions', {
          currentHour,
          action: 'manual_eod_force'
        });
      } else {
        console.log('🌅 End of day detected, checking positions to close...');
        await this.logActivity('signal_processed', `End of day detected (hour: ${currentHour}), checking positions`, {
          currentHour,
          action: 'auto_eod_detected'
        });
      }

      // Get all active positions
      const { data: activeTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .in('status', ['filled', 'partial_filled']);

      if (error) {
        console.error('❌ Error fetching active trades:', error);
        await this.logActivity('system_error', 'Error fetching active trades for EOD', { 
          error: error.message,
          action: 'trade_fetch_failed'
        });
        return;
      }

      if (!activeTrades || activeTrades.length === 0) {
        console.log('📭 No active positions to close');
        await this.logActivity('signal_processed', 'No active positions found for EOD closure', {
          activeTradeCount: 0,
          action: 'no_trades_found'
        });
        return;
      }

      console.log(`📊 Found ${activeTrades.length} active positions to evaluate for EOD closure`);
      await this.logActivity('signal_processed', `Found ${activeTrades.length} active positions for EOD evaluation`, {
        activeTradeCount: activeTrades.length,
        tradeSymbols: activeTrades.map(t => t.symbol),
        action: 'trades_found_for_eod'
      });

      let closedTrades = [];
      let keptTrades = [];

      for (const trade of activeTrades) {
        const result = await this.evaluateTradeForEODClosure(trade, config, forceSimulation);
        if (result.closed) {
          closedTrades.push(result);
        } else {
          keptTrades.push(result);
        }
      }

      console.log('✅ End-of-day management completed');
      console.log(`📊 Summary: ${closedTrades.length} trades closed, ${keptTrades.length} trades kept open`);
      
      await this.logActivity('signal_processed', 'End-of-day management completed', {
        totalTrades: activeTrades.length,
        closedCount: closedTrades.length,
        keptCount: keptTrades.length,
        closedTrades: closedTrades.map(t => ({ symbol: t.symbol, profit: t.profit })),
        action: 'eod_completed'
      });

      // Log detailed summary
      if (closedTrades.length > 0) {
        console.log(`🎯 EOD CLOSURE SUMMARY:`);
        closedTrades.forEach(trade => {
          console.log(`   ${trade.symbol}: Entry=$${trade.entryPrice.toFixed(4)}, Exit=$${trade.exitPrice.toFixed(4)}, P&L=$${trade.profit.toFixed(2)} (${trade.profitPercent.toFixed(2)}%)`);
        });
      }

    } catch (error) {
      console.error('❌ Error in end-of-day management:', error);
      await this.logActivity('system_error', 'Error in end-of-day management', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        forceSimulation,
        action: 'eod_failed'
      });
      throw error;
    }
  }

  private async evaluateTradeForEODClosure(trade: any, config: TradingConfigData, forceSimulation: boolean = false): Promise<any> {
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
        
        await this.logActivity('signal_processed', `Closing position for ${reason}: ${trade.symbol}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          entryPrice,
          currentPrice,
          plPercentage,
          reason,
          action: 'closing_position'
        });

        const closeResult = await this.closePosition(trade, currentPrice, reason);
        return {
          symbol: trade.symbol,
          entryPrice,
          exitPrice: currentPrice,
          profit: closeResult.profit,
          profitPercent: plPercentage,
          closed: true,
          reason
        };
      } else {
        const threshold = forceSimulation ? '0%' : `${config.eod_close_premium_percent}%`;
        console.log(`✅ Keeping position open: ${trade.symbol} (P&L ${forceSimulation ? 'not above' : 'above'} ${threshold})`);
        
        await this.logActivity('signal_processed', `Keeping position open: ${trade.symbol}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          entryPrice,
          currentPrice,
          plPercentage,
          threshold,
          action: 'keeping_position'
        });

        return {
          symbol: trade.symbol,
          entryPrice,
          currentPrice,
          profit: 0,
          profitPercent: plPercentage,
          closed: false,
          reason: 'kept_open'
        };
      }

    } catch (error) {
      console.error(`❌ Error evaluating trade ${trade.id} for EOD closure:`, error);
      await this.logActivity('system_error', `Error evaluating trade for EOD closure: ${trade.symbol}`, {
        tradeId: trade.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'evaluation_failed'
      });
      return {
        symbol: trade.symbol,
        closed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async closePosition(trade: any, closePrice: number, reason: string): Promise<any> {
    try {
      // Place market sell order
      const sellQuantity = parseFloat(trade.quantity.toString());
      
      console.log(`📤 Placing market sell order for ${trade.symbol}: ${sellQuantity} at market price`);

      const sellOrder = await this.bybitService.placeOrder({
        category: 'spot',
        symbol: trade.symbol,
        side: 'Sell',
        orderType: 'Market',
        qty: sellQuantity.toString(),
      });

      console.log('EOD sell order result:', sellOrder);

      if (sellOrder && sellOrder.retCode === 0 && sellOrder.result?.orderId) {
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
            error: error.message,
            action: 'database_update_failed'
          });
          throw error;
        } else {
          console.log(`✅ Position closed: ${trade.symbol}, P&L: $${profitLoss.toFixed(2)}`);
          await this.logActivity('position_closed', `${reason}: ${trade.symbol}`, {
            tradeId: trade.id,
            symbol: trade.symbol,
            entryPrice,
            closePrice,
            profitLoss,
            profitPercent: ((closePrice - entryPrice) / entryPrice * 100).toFixed(2),
            reason,
            bybitOrderId: sellOrder.result.orderId,
            action: 'position_closed_success'
          });

          return { profit: profitLoss };
        }
      } else {
        const errorMsg = `Failed to place sell order - ${sellOrder?.retMsg || 'no order ID returned'}`;
        console.error(errorMsg);
        await this.logActivity('order_failed', errorMsg, {
          tradeId: trade.id,
          symbol: trade.symbol,
          sellOrder,
          action: 'sell_order_failed'
        });
        throw new Error(errorMsg);
      }

    } catch (error) {
      console.error(`❌ Error closing position for trade ${trade.id}:`, error);
      await this.logActivity('system_error', `Failed to close position: ${trade.symbol}`, {
        tradeId: trade.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'close_position_failed'
      });
      throw error;
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
