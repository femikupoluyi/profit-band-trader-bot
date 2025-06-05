
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
      console.log('🌅 EOD Manager - Starting End-of-Day Management...');
      await this.logger.logSuccess('Starting End-of-Day Management', { 
        forceSimulation,
        autoCloseEnabled: config.auto_close_at_end_of_day,
        eodThreshold: config.eod_close_premium_percent
      });

      if (!config.auto_close_at_end_of_day && !forceSimulation) {
        console.log('⏸️ EOD auto-close is disabled and not forcing simulation');
        await this.logger.logSuccess('EOD auto-close disabled, skipping', { 
          autoCloseEnabled: false,
          forceSimulation: false
        });
        return;
      }

      // Get filled trades to evaluate for closure
      const { data: filledTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'filled');

      if (error) {
        console.error('❌ Error fetching filled trades:', error);
        await this.logger.logError('Failed to fetch filled trades for EOD', error);
        throw error;
      }

      if (!filledTrades || filledTrades.length === 0) {
        console.log('📭 No filled trades found for EOD evaluation');
        await this.logger.logSuccess('No filled trades found for EOD evaluation');
        return;
      }

      console.log(`📊 Found ${filledTrades.length} filled trades to evaluate for EOD closure`);
      await this.logger.logSuccess(`Found ${filledTrades.length} trades to evaluate`, {
        tradeCount: filledTrades.length
      });

      let closedCount = 0;
      let totalProfit = 0;

      for (const trade of filledTrades) {
        try {
          const result = await this.evaluateTradeForEODClosure(trade, config, forceSimulation);
          if (result.closed) {
            closedCount++;
            totalProfit += result.profit || 0;
          }
        } catch (error) {
          console.error(`❌ Error evaluating trade ${trade.id}:`, error);
          await this.logger.logError(`Failed to evaluate trade ${trade.id}`, error, {
            tradeId: trade.id,
            symbol: trade.symbol
          });
        }
      }

      console.log(`✅ EOD Management completed: ${closedCount} trades closed with total profit: $${totalProfit.toFixed(2)}`);
      await this.logger.logSuccess(`EOD Management completed`, {
        closedTrades: closedCount,
        totalProfit: totalProfit,
        totalEvaluated: filledTrades.length
      });

    } catch (error) {
      console.error('❌ Error in EOD Management:', error);
      await this.logger.logError('EOD Management failed', error);
      throw error;
    }
  }

  private async evaluateTradeForEODClosure(trade: any, config: TradingConfigData, forceSimulation: boolean): Promise<{closed: boolean, profit?: number}> {
    try {
      console.log(`\n🔍 Evaluating trade ${trade.id} (${trade.symbol}) for EOD closure...`);
      await this.logger.logSuccess(`Evaluating trade: ${trade.symbol}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        status: trade.status
      });

      console.log(`🔍 Evaluating ${trade.symbol} for EOD closure...`);
      await this.logger.logSuccess(`Evaluating ${trade.symbol} for closure`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        forceSimulation
      });

      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());

      console.log(`📊 Trade Analysis for ${trade.symbol}:`);
      console.log(`  Entry Price: $${entryPrice.toFixed(6)}`);
      console.log(`  Current Price: $${currentPrice.toFixed(6)}`);
      console.log(`  Quantity: ${quantity}`);

      // Calculate P&L
      let profitPercent = 0;
      let dollarProfit = 0;

      if (trade.side === 'buy') {
        profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
        dollarProfit = (currentPrice - entryPrice) * quantity;
      } else {
        profitPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
        dollarProfit = (entryPrice - currentPrice) * quantity;
      }

      console.log(`💰 P&L Analysis:`);
      console.log(`  Profit %: ${profitPercent.toFixed(2)}%`);
      console.log(`  Dollar P&L: $${dollarProfit.toFixed(2)}`);
      console.log(`  EOD Threshold: ${config.eod_close_premium_percent}%`);

      await this.logger.logSuccess(`P&L calculated for ${trade.symbol}`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        entryPrice,
        currentPrice,
        profitPercent: profitPercent.toFixed(2),
        dollarProfit: dollarProfit.toFixed(2),
        eodThreshold: config.eod_close_premium_percent
      });

      // Check closure conditions
      let shouldClose = false;
      let reason = '';

      if (forceSimulation) {
        // In simulation mode, close trades with any profit
        if (dollarProfit > 0) {
          shouldClose = true;
          reason = 'EOD simulation - closing profitable trades';
        } else {
          reason = 'EOD simulation - trade not profitable';
        }
      } else {
        // Normal EOD mode, use threshold
        if (profitPercent >= config.eod_close_premium_percent) {
          shouldClose = true;
          reason = `Profit ${profitPercent.toFixed(2)}% >= EOD threshold ${config.eod_close_premium_percent}%`;
        } else {
          reason = `Profit ${profitPercent.toFixed(2)}% < EOD threshold ${config.eod_close_premium_percent}%`;
        }
      }

      console.log(`🎯 Closure Decision: ${shouldClose ? 'CLOSE' : 'KEEP'} - ${reason}`);

      if (shouldClose) {
        console.log(`🔄 Closing ${trade.symbol} position via EOD...`);
        await this.logger.logTradeAction(`Closing EOD position`, trade.symbol, {
          tradeId: trade.id,
          reason,
          profitPercent,
          dollarProfit,
          entryPrice,
          currentPrice
        });

        // Place market sell order to close position
        const sellOrderParams = {
          category: 'spot' as const,
          symbol: trade.symbol,
          side: 'Sell' as const,
          orderType: 'Market' as const,
          qty: trade.quantity.toString(),
        };

        const sellResult = await this.bybitService.placeOrder(sellOrderParams);

        if (sellResult && sellResult.retCode === 0) {
          // Update trade status to closed
          const { error: updateError } = await supabase
            .from('trades')
            .update({
              status: 'closed',
              profit_loss: dollarProfit,
              updated_at: new Date().toISOString()
            })
            .eq('id', trade.id);

          if (updateError) {
            console.error('❌ Database update error:', updateError);
            await this.logger.logError('Failed to update trade status after EOD close', updateError, {
              tradeId: trade.id
            });
            throw updateError;
          }

          console.log(`✅ ${trade.symbol} position closed successfully via EOD`);
          await this.logger.log('position_closed', `EOD position closed: ${trade.symbol}`, {
            tradeId: trade.id,
            symbol: trade.symbol,
            profitPercent: profitPercent.toFixed(2),
            dollarProfit: dollarProfit.toFixed(2),
            bybitOrderId: sellResult.result?.orderId,
            closureReason: reason
          });

          return { closed: true, profit: dollarProfit };
        } else {
          console.error(`❌ Failed to place EOD sell order for ${trade.symbol}:`, sellResult);
          await this.logger.log('order_failed', `EOD sell order failed for ${trade.symbol}`, {
            tradeId: trade.id,
            sellResult,
            reason: sellResult?.retMsg
          });
          return { closed: false };
        }
      } else {
        console.log(`📈 Keeping ${trade.symbol} position - ${reason}`);
        await this.logger.logSuccess(`Keeping position: ${trade.symbol}`, {
          tradeId: trade.id,
          symbol: trade.symbol,
          reason,
          profitPercent: profitPercent.toFixed(2),
          dollarProfit: dollarProfit.toFixed(2)
        });
        return { closed: false };
      }

    } catch (error) {
      console.error(`❌ Error evaluating trade ${trade.id}:`, error);
      await this.logger.logError(`Error evaluating trade ${trade.id}`, error, {
        tradeId: trade.id,
        symbol: trade.symbol
      });
      return { closed: false };
    }
  }
}
