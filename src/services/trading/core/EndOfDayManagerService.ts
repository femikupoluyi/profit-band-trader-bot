
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
      console.log('🌅 EOD MANAGER SERVICE - Starting end-of-day management');
      
      // Enhanced initial logging
      await this.logActivity('signal_processed', `[EOD] Starting end-of-day management (force: ${forceSimulation})`, {
        forceSimulation,
        autoCloseEnabled: config.auto_close_at_end_of_day,
        eodThreshold: config.eod_close_premium_percent,
        action: 'eod_manager_start',
        timestamp: new Date().toISOString()
      });

      if (!config.auto_close_at_end_of_day && !forceSimulation) {
        console.log('⏸️ End-of-day auto-close is disabled');
        await this.logActivity('signal_processed', '[EOD] End-of-day auto-close is disabled', {
          autoCloseEnabled: false,
          forceSimulation: false,
          action: 'eod_disabled'
        });
        return;
      }

      // Check if we're near end of day (for now, just check if it's past 22:00 UTC)
      const currentHour = new Date().getUTCHours();
      const isEndOfDay = currentHour >= 22; // 10 PM UTC

      console.log(`🕐 Current UTC hour: ${currentHour}, End of day threshold: 22:00`);
      await this.logActivity('signal_processed', `[EOD] Time check - Current hour: ${currentHour} UTC`, {
        currentHour,
        isEndOfDay,
        forceSimulation,
        action: 'eod_time_check'
      });

      // For manual simulation, always proceed regardless of time
      if (!isEndOfDay && !forceSimulation) {
        console.log(`⏰ Not end of day yet (current hour: ${currentHour} UTC)`);
        await this.logActivity('signal_processed', `[EOD] Not end of day yet (current hour: ${currentHour} UTC)`, {
          currentHour,
          action: 'eod_not_time'
        });
        return;
      }

      if (forceSimulation) {
        console.log('🔄 MANUAL EOD SIMULATION - Processing all positions regardless of time');
        await this.logActivity('signal_processed', '[EOD] Manual EOD simulation - processing all positions', {
          currentHour,
          action: 'manual_eod_force'
        });
      } else {
        console.log('🌅 End of day detected, checking positions to close...');
        await this.logActivity('signal_processed', `[EOD] End of day detected (hour: ${currentHour}), checking positions`, {
          currentHour,
          action: 'auto_eod_detected'
        });
      }

      // Get all active positions with enhanced error handling
      console.log('🔍 Fetching active trades...');
      const { data: activeTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .in('status', ['filled', 'partial_filled']);

      if (error) {
        console.error('❌ Error fetching active trades:', error);
        await this.logActivity('system_error', '[EOD] Error fetching active trades', { 
          error: error.message,
          errorCode: error.code,
          action: 'trade_fetch_failed'
        });
        return;
      }

      if (!activeTrades || activeTrades.length === 0) {
        console.log('📭 No active positions to close');
        await this.logActivity('signal_processed', '[EOD] No active positions found for EOD closure', {
          activeTradeCount: 0,
          action: 'no_trades_found'
        });
        return;
      }

      console.log(`📊 Found ${activeTrades.length} active positions to evaluate for EOD closure`);
      await this.logActivity('signal_processed', `[EOD] Found ${activeTrades.length} active positions for EOD evaluation`, {
        activeTradeCount: activeTrades.length,
        tradeSymbols: activeTrades.map(t => t.symbol),
        tradeIds: activeTrades.map(t => t.id),
        action: 'trades_found_for_eod'
      });

      let closedTrades = [];
      let keptTrades = [];
      let failedTrades = [];

      for (const trade of activeTrades) {
        console.log(`\n🔍 Evaluating trade ${trade.id} (${trade.symbol}) for EOD closure...`);
        await this.logActivity('signal_processed', `[EOD] Evaluating trade: ${trade.symbol}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          status: trade.status,
          action: 'evaluating_trade'
        });

        try {
          const result = await this.evaluateTradeForEODClosure(trade, config, forceSimulation);
          if (result.closed) {
            closedTrades.push(result);
            console.log(`✅ Trade ${trade.id} (${trade.symbol}) closed successfully`);
          } else if (result.error) {
            failedTrades.push(result);
            console.log(`❌ Trade ${trade.id} (${trade.symbol}) failed to close: ${result.error}`);
          } else {
            keptTrades.push(result);
            console.log(`📈 Trade ${trade.id} (${trade.symbol}) kept open`);
          }
        } catch (tradeError) {
          console.error(`❌ Error processing trade ${trade.id}:`, tradeError);
          failedTrades.push({
            symbol: trade.symbol,
            tradeId: trade.id,
            closed: false,
            error: tradeError instanceof Error ? tradeError.message : 'Unknown error'
          });
          await this.logActivity('system_error', `[EOD] Error processing trade ${trade.symbol}`, {
            tradeId: trade.id,
            error: tradeError instanceof Error ? tradeError.message : 'Unknown error',
            action: 'trade_processing_error'
          });
        }
      }

      console.log('✅ End-of-day management completed');
      console.log(`📊 Summary: ${closedTrades.length} trades closed, ${keptTrades.length} trades kept open, ${failedTrades.length} trades failed`);
      
      await this.logActivity('signal_processed', '[EOD] End-of-day management completed', {
        totalTrades: activeTrades.length,
        closedCount: closedTrades.length,
        keptCount: keptTrades.length,
        failedCount: failedTrades.length,
        closedTrades: closedTrades.map(t => ({ symbol: t.symbol, profit: t.profit, profitPercent: t.profitPercent })),
        keptTrades: keptTrades.map(t => ({ symbol: t.symbol, profitPercent: t.profitPercent })),
        failedTrades: failedTrades.map(t => ({ symbol: t.symbol, error: t.error })),
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
      await this.logActivity('system_error', '[EOD] Error in end-of-day management', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        forceSimulation,
        action: 'eod_failed'
      });
      throw error;
    }
  }

  private async evaluateTradeForEODClosure(trade: any, config: TradingConfigData, forceSimulation: boolean = false): Promise<any> {
    try {
      console.log(`🔍 Evaluating ${trade.symbol} for EOD closure...`);
      await this.logActivity('signal_processed', `[EOD] Evaluating ${trade.symbol} for closure`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        forceSimulation,
        action: 'trade_evaluation_start'
      });

      // Get current market price with enhanced error handling
      let marketPrice;
      try {
        marketPrice = await this.bybitService.getMarketPrice(trade.symbol);
        console.log(`✅ Market price for ${trade.symbol}: $${marketPrice.price}`);
        await this.logActivity('signal_processed', `[EOD] Market price retrieved for ${trade.symbol}: $${marketPrice.price}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          marketPrice: marketPrice.price,
          action: 'market_price_retrieved'
        });
      } catch (priceError) {
        const errorMsg = `Failed to get market price for ${trade.symbol}: ${priceError instanceof Error ? priceError.message : 'Unknown error'}`;
        console.error('❌ Market price error:', priceError);
        await this.logActivity('system_error', `[EOD] ${errorMsg}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          error: priceError instanceof Error ? priceError.message : 'Unknown error',
          action: 'market_price_failed'
        });
        return {
          symbol: trade.symbol,
          tradeId: trade.id,
          closed: false,
          error: errorMsg
        };
      }

      const currentPrice = marketPrice.price;
      const entryPrice = parseFloat(trade.price.toString());
      const plPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;
      
      console.log(`  Entry: $${entryPrice.toFixed(4)}, Current: $${currentPrice.toFixed(4)}, P&L: ${plPercentage.toFixed(2)}%`);
      await this.logActivity('signal_processed', `[EOD] P&L calculated for ${trade.symbol}: ${plPercentage.toFixed(2)}%`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        entryPrice,
        currentPrice,
        plPercentage,
        action: 'pnl_calculated'
      });

      // For manual simulation, close if profitable (above 0%)
      // For regular EOD, close if below the threshold
      let shouldClose = false;
      let threshold = '';
      if (forceSimulation) {
        shouldClose = plPercentage > 0; // Close profitable positions in simulation
        threshold = '0%';
        console.log(`  Manual simulation: ${shouldClose ? 'CLOSING' : 'KEEPING'} (profit threshold: 0%)`);
      } else {
        shouldClose = plPercentage < config.eod_close_premium_percent;
        threshold = `${config.eod_close_premium_percent}%`;
        console.log(`  Regular EOD: ${shouldClose ? 'CLOSING' : 'KEEPING'} (threshold: ${config.eod_close_premium_percent}%)`);
      }
      
      await this.logActivity('signal_processed', `[EOD] Close decision for ${trade.symbol}: ${shouldClose ? 'CLOSING' : 'KEEPING'}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        shouldClose,
        plPercentage,
        threshold,
        forceSimulation,
        action: 'close_decision'
      });
      
      if (shouldClose) {
        const reason = forceSimulation ? 'manual_eod_simulation' : 'eod_auto_close';
        console.log(`🔄 Closing position for ${reason}: ${trade.symbol} (P&L: ${plPercentage.toFixed(2)}%)`);
        
        await this.logActivity('signal_processed', `[EOD] Closing position for ${reason}: ${trade.symbol}`, {
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
          tradeId: trade.id,
          entryPrice,
          exitPrice: currentPrice,
          profit: closeResult.profit,
          profitPercent: plPercentage,
          closed: true,
          reason
        };
      } else {
        const thresholdMsg = forceSimulation ? '0%' : `${config.eod_close_premium_percent}%`;
        console.log(`✅ Keeping position open: ${trade.symbol} (P&L ${forceSimulation ? 'not above' : 'above'} ${thresholdMsg})`);
        
        await this.logActivity('signal_processed', `[EOD] Keeping position open: ${trade.symbol}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          entryPrice,
          currentPrice,
          plPercentage,
          threshold: thresholdMsg,
          action: 'keeping_position'
        });

        return {
          symbol: trade.symbol,
          tradeId: trade.id,
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
      await this.logActivity('system_error', `[EOD] Error evaluating trade for EOD closure: ${trade.symbol}`, {
        tradeId: trade.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        action: 'evaluation_failed'
      });
      return {
        symbol: trade.symbol,
        tradeId: trade.id,
        closed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async closePosition(trade: any, closePrice: number, reason: string): Promise<any> {
    try {
      console.log(`📤 Placing market sell order for ${trade.symbol}...`);
      await this.logActivity('signal_processed', `[EOD] Placing market sell order for ${trade.symbol}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        closePrice,
        quantity: trade.quantity,
        reason,
        action: 'placing_sell_order'
      });

      // Place market sell order
      const sellQuantity = parseFloat(trade.quantity.toString());
      const sellOrderParams = {
        category: 'spot' as const,
        symbol: trade.symbol,
        side: 'Sell' as const,
        orderType: 'Market' as const,
        qty: sellQuantity.toString(),
      };

      let sellOrder;
      try {
        sellOrder = await this.bybitService.placeOrder(sellOrderParams);
        console.log('✅ Bybit sell order response:', sellOrder);
        await this.logActivity('signal_processed', `[EOD] Bybit sell order response received for ${trade.symbol}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          sellOrder: {
            retCode: sellOrder?.retCode,
            retMsg: sellOrder?.retMsg,
            orderId: sellOrder?.result?.orderId
          },
          action: 'bybit_sell_order_response'
        });
      } catch (orderError) {
        const errorMsg = `Bybit sell order failed for ${trade.symbol}: ${orderError instanceof Error ? orderError.message : 'Unknown error'}`;
        console.error('❌ Bybit sell order error:', orderError);
        await this.logActivity('order_failed', `[EOD] ${errorMsg}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          error: orderError instanceof Error ? orderError.message : 'Unknown error',
          sellOrderParams,
          action: 'bybit_sell_order_failed'
        });
        throw new Error(errorMsg);
      }

      if (sellOrder && sellOrder.retCode === 0 && sellOrder.result?.orderId) {
        // Calculate final P&L
        const entryPrice = parseFloat(trade.price.toString());
        const profitLoss = (closePrice - entryPrice) * sellQuantity;
        
        console.log(`💰 P&L for ${trade.symbol}: $${profitLoss.toFixed(2)}`);
        await this.logActivity('signal_processed', `[EOD] P&L calculated for ${trade.symbol}: $${profitLoss.toFixed(2)}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          entryPrice,
          closePrice,
          sellQuantity,
          profitLoss,
          action: 'pnl_calculated_for_close'
        });
        
        // Update trade in database
        const { error: updateError } = await supabase
          .from('trades')
          .update({
            status: 'closed',
            profit_loss: profitLoss,
            updated_at: new Date().toISOString()
          })
          .eq('id', trade.id);

        if (updateError) {
          console.error(`❌ Error updating closed trade ${trade.id}:`, updateError);
          await this.logActivity('system_error', `[EOD] Error updating closed trade: ${trade.symbol}`, {
            tradeId: trade.id,
            error: updateError.message,
            action: 'database_update_failed'
          });
          throw updateError;
        } else {
          console.log(`✅ Position closed: ${trade.symbol}, P&L: $${profitLoss.toFixed(2)}`);
          await this.logActivity('position_closed', `[EOD] ${reason}: ${trade.symbol}`, {
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
        const errorMsg = `Failed to place sell order - ${sellOrder?.retMsg || 'no order ID returned'} (Code: ${sellOrder?.retCode})`;
        console.error('❌ Sell order failed:', errorMsg);
        await this.logActivity('order_failed', `[EOD] ${errorMsg}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          sellOrder,
          action: 'sell_order_failed'
        });
        throw new Error(errorMsg);
      }

    } catch (error) {
      console.error(`❌ Error closing position for trade ${trade.id}:`, error);
      await this.logActivity('system_error', `[EOD] Failed to close position: ${trade.symbol}`, {
        tradeId: trade.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
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
        'system_info': 'signal_processed',
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
      console.error('❌ Error logging activity:', error);
    }
  }
}
