
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';

export class EndOfDayManagerService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.bybitService.setLogger(this.logger);
  }

  async manageEndOfDay(config: TradingConfigData, forceSimulation: boolean = false): Promise<void> {
    try {
      console.log('🌅 EOD MANAGER SERVICE - Starting end-of-day management');
      await this.logger.logSuccess(`Starting end-of-day management (force: ${forceSimulation})`, {
        forceSimulation,
        autoCloseEnabled: config.auto_close_at_end_of_day,
        eodThreshold: config.eod_close_premium_percent
      });

      if (!config.auto_close_at_end_of_day && !forceSimulation) {
        console.log('⏸️ End-of-day auto-close is disabled');
        await this.logger.logSuccess('End-of-day auto-close is disabled', {
          autoCloseEnabled: false,
          forceSimulation: false
        });
        return;
      }

      // Check if we're near end of day (for now, just check if it's past 22:00 UTC)
      const currentHour = new Date().getUTCHours();
      const isEndOfDay = currentHour >= 22; // 10 PM UTC

      console.log(`🕐 Current UTC hour: ${currentHour}, End of day threshold: 22:00`);
      await this.logger.logSuccess(`Time check - Current hour: ${currentHour} UTC`, {
        currentHour,
        isEndOfDay,
        forceSimulation
      });

      // For manual simulation, always proceed regardless of time
      if (!isEndOfDay && !forceSimulation) {
        console.log(`⏰ Not end of day yet (current hour: ${currentHour} UTC)`);
        await this.logger.logSuccess(`Not end of day yet (current hour: ${currentHour} UTC)`, {
          currentHour
        });
        return;
      }

      if (forceSimulation) {
        console.log('🔄 MANUAL EOD SIMULATION - Processing all positions regardless of time');
        await this.logger.logSuccess('Manual EOD simulation - processing all positions', {
          currentHour
        });
      } else {
        console.log('🌅 End of day detected, checking positions to close...');
        await this.logger.logSuccess(`End of day detected (hour: ${currentHour}), checking positions`, {
          currentHour
        });
      }

      // Get all active positions
      console.log('🔍 Fetching active trades...');
      const { data: activeTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .in('status', ['filled', 'partial_filled']);

      if (error) {
        console.error('❌ Error fetching active trades:', error);
        await this.logger.logError('Error fetching active trades', error);
        return;
      }

      if (!activeTrades || activeTrades.length === 0) {
        console.log('📭 No active positions to close');
        await this.logger.logSuccess('No active positions found for EOD closure', {
          activeTradeCount: 0
        });
        return;
      }

      console.log(`📊 Found ${activeTrades.length} active positions to evaluate for EOD closure`);
      await this.logger.logSuccess(`Found ${activeTrades.length} active positions for EOD evaluation`, {
        activeTradeCount: activeTrades.length,
        tradeSymbols: activeTrades.map(t => t.symbol),
        tradeIds: activeTrades.map(t => t.id)
      });

      let closedTrades = [];
      let keptTrades = [];
      let failedTrades = [];

      for (const trade of activeTrades) {
        console.log(`\n🔍 Evaluating trade ${trade.id} (${trade.symbol}) for EOD closure...`);
        await this.logger.logSuccess(`Evaluating trade: ${trade.symbol}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          status: trade.status
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
          await this.logger.logError(`Error processing trade ${trade.symbol}`, tradeError, {
            tradeId: trade.id
          });
        }
      }

      console.log('✅ End-of-day management completed');
      console.log(`📊 Summary: ${closedTrades.length} trades closed, ${keptTrades.length} trades kept open, ${failedTrades.length} trades failed`);
      
      await this.logger.logSuccess('End-of-day management completed', {
        totalTrades: activeTrades.length,
        closedCount: closedTrades.length,
        keptCount: keptTrades.length,
        failedCount: failedTrades.length,
        closedTrades: closedTrades.map(t => ({ symbol: t.symbol, profit: t.profit, profitPercent: t.profitPercent })),
        keptTrades: keptTrades.map(t => ({ symbol: t.symbol, profitPercent: t.profitPercent })),
        failedTrades: failedTrades.map(t => ({ symbol: t.symbol, error: t.error }))
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
      await this.logger.logError('Error in end-of-day management', error, { forceSimulation });
      throw error;
    }
  }

  private async evaluateTradeForEODClosure(trade: any, config: TradingConfigData, forceSimulation: boolean = false): Promise<any> {
    try {
      console.log(`🔍 Evaluating ${trade.symbol} for EOD closure...`);
      await this.logger.logSuccess(`Evaluating ${trade.symbol} for closure`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        forceSimulation
      });

      // Get current market price
      let marketPrice;
      try {
        marketPrice = await this.bybitService.getMarketPrice(trade.symbol);
        console.log(`✅ Market price for ${trade.symbol}: $${marketPrice.price}`);
        await this.logger.logSuccess(`Market price retrieved for ${trade.symbol}: $${marketPrice.price}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          marketPrice: marketPrice.price
        });
      } catch (priceError) {
        const errorMsg = `Failed to get market price for ${trade.symbol}: ${priceError instanceof Error ? priceError.message : 'Unknown error'}`;
        console.error('❌ Market price error:', priceError);
        await this.logger.logError(errorMsg, priceError, {
          tradeId: trade.id,
          symbol: trade.symbol
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
      await this.logger.logSuccess(`P&L calculated for ${trade.symbol}: ${plPercentage.toFixed(2)}%`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        entryPrice,
        currentPrice,
        plPercentage
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
      
      await this.logger.logSuccess(`Close decision for ${trade.symbol}: ${shouldClose ? 'CLOSING' : 'KEEPING'}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        shouldClose,
        plPercentage,
        threshold,
        forceSimulation
      });
      
      if (shouldClose) {
        const reason = forceSimulation ? 'manual_eod_simulation' : 'eod_auto_close';
        console.log(`🔄 Closing position for ${reason}: ${trade.symbol} (P&L: ${plPercentage.toFixed(2)}%)`);
        
        await this.logger.logSuccess(`Closing position for ${reason}: ${trade.symbol}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          entryPrice,
          currentPrice,
          plPercentage,
          reason
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
        
        await this.logger.logSuccess(`Keeping position open: ${trade.symbol}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          entryPrice,
          currentPrice,
          plPercentage,
          threshold: thresholdMsg
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
      await this.logger.logError(`Error evaluating trade for EOD closure: ${trade.symbol}`, error, {
        tradeId: trade.id
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
      await this.logger.logSuccess(`Placing market sell order for ${trade.symbol}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        closePrice,
        quantity: trade.quantity,
        reason
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
        await this.logger.logSuccess(`Bybit sell order response received for ${trade.symbol}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          sellOrder: {
            retCode: sellOrder?.retCode,
            retMsg: sellOrder?.retMsg,
            orderId: sellOrder?.result?.orderId
          }
        });
      } catch (orderError) {
        const errorMsg = `Bybit sell order failed for ${trade.symbol}: ${orderError instanceof Error ? orderError.message : 'Unknown error'}`;
        console.error('❌ Bybit sell order error:', orderError);
        await this.logger.log('order_failed', errorMsg, {
          tradeId: trade.id,
          symbol: trade.symbol,
          error: orderError instanceof Error ? orderError.message : 'Unknown error',
          sellOrderParams
        });
        throw new Error(errorMsg);
      }

      if (sellOrder && sellOrder.retCode === 0 && sellOrder.result?.orderId) {
        // Calculate final P&L
        const entryPrice = parseFloat(trade.price.toString());
        const profitLoss = (closePrice - entryPrice) * sellQuantity;
        
        console.log(`💰 P&L for ${trade.symbol}: $${profitLoss.toFixed(2)}`);
        await this.logger.logSuccess(`P&L calculated for ${trade.symbol}: $${profitLoss.toFixed(2)}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          entryPrice,
          closePrice,
          sellQuantity,
          profitLoss
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
          await this.logger.logError(`Error updating closed trade: ${trade.symbol}`, updateError, {
            tradeId: trade.id
          });
          throw updateError;
        } else {
          console.log(`✅ Position closed: ${trade.symbol}, P&L: $${profitLoss.toFixed(2)}`);
          await this.logger.log('position_closed', `${reason}: ${trade.symbol}`, {
            tradeId: trade.id,
            symbol: trade.symbol,
            entryPrice,
            closePrice,
            profitLoss,
            profitPercent: ((closePrice - entryPrice) / entryPrice * 100).toFixed(2),
            reason,
            bybitOrderId: sellOrder.result.orderId
          });

          return { profit: profitLoss };
        }
      } else {
        const errorMsg = `Failed to place sell order - ${sellOrder?.retMsg || 'no order ID returned'} (Code: ${sellOrder?.retCode})`;
        console.error('❌ Sell order failed:', errorMsg);
        await this.logger.log('order_failed', errorMsg, {
          tradeId: trade.id,
          symbol: trade.symbol,
          sellOrder
        });
        throw new Error(errorMsg);
      }

    } catch (error) {
      console.error(`❌ Error closing position for trade ${trade.id}:`, error);
      await this.logger.logError(`Failed to close position: ${trade.symbol}`, error, {
        tradeId: trade.id
      });
      throw error;
    }
  }
}
