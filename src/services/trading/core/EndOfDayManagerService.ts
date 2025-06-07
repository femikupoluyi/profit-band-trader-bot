
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
      console.log('🌅 Starting End-of-Day Management...');
      
      if (!config.auto_close_at_end_of_day && !forceSimulation) {
        console.log('📭 Auto EOD close disabled, skipping');
        return;
      }

      // Check if it's actually end of day (unless forcing simulation)
      if (!forceSimulation && !this.isEndOfDay(config)) {
        console.log('⏰ Not yet end of day, skipping');
        return;
      }

      console.log('🎯 EOD conditions met, checking positions to close...');
      await this.logger.logSuccess('EOD management started', { 
        forceSimulation,
        autoClose: config.auto_close_at_end_of_day
      });

      // Get all open positions
      const { data: openTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'filled');

      if (error) {
        console.error('❌ Error fetching open trades:', error);
        await this.logger.logError('Error fetching open trades for EOD', error);
        return;
      }

      if (!openTrades || openTrades.length === 0) {
        console.log('📭 No open positions to close');
        return;
      }

      console.log(`📊 Found ${openTrades.length} open positions to evaluate for EOD close`);

      for (const trade of openTrades) {
        await this.evaluateAndClosePosition(trade, config);
      }

      await this.logger.logSuccess('EOD management completed');
      console.log('✅ End-of-Day Management completed');
    } catch (error) {
      console.error('❌ Error in EOD management:', error);
      await this.logger.logError('EOD management failed', error);
    }
  }

  private async evaluateAndClosePosition(trade: any, config: TradingConfigData): Promise<void> {
    try {
      console.log(`\n🔍 Evaluating position ${trade.id} (${trade.symbol}) for EOD close...`);

      // Get current market price
      const marketData = await this.bybitService.getMarketPrice(trade.symbol);
      const currentPrice = marketData.price;
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());

      // Calculate current P&L
      const profit = (currentPrice - entryPrice) * quantity;
      const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

      console.log(`  Entry: $${entryPrice.toFixed(4)}, Current: $${currentPrice.toFixed(4)}`);
      console.log(`  P&L: $${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)`);

      // Check if position is profitable enough to close
      const eodThreshold = config.eod_close_premium_percent || 0.1;
      
      if (profitPercent >= eodThreshold) {
        console.log(`✅ Position is profitable (${profitPercent.toFixed(2)}% >= ${eodThreshold}%), closing...`);
        await this.closePositionAtMarket(trade, currentPrice, profit);
      } else {
        console.log(`📊 Position below EOD threshold (${profitPercent.toFixed(2)}% < ${eodThreshold}%), keeping open`);
        await this.logger.logSuccess(`Position ${trade.symbol} kept open - below EOD threshold`, {
          symbol: trade.symbol,
          profitPercent,
          threshold: eodThreshold
        });
      }
    } catch (error) {
      console.error(`❌ Error evaluating position ${trade.id}:`, error);
      await this.logger.logError(`Failed to evaluate position for EOD close`, error, {
        tradeId: trade.id,
        symbol: trade.symbol
      });
    }
  }

  private async closePositionAtMarket(trade: any, currentPrice: number, profit: number): Promise<void> {
    try {
      console.log(`🎯 Closing position ${trade.symbol} at market price...`);

      // Place market sell order
      const sellOrderParams = {
        category: 'spot' as const,
        symbol: trade.symbol,
        side: 'Sell' as const,
        orderType: 'Market' as const,
        qty: trade.quantity.toString(),
      };

      const sellResult = await this.bybitService.placeOrder(sellOrderParams);

      if (sellResult && sellResult.retCode === 0) {
        console.log(`✅ EOD market sell order placed: ${sellResult.result?.orderId || 'No ID'}`);

        // Update trade status
        const { error: updateError } = await supabase
          .from('trades')
          .update({
            status: 'closed',
            profit_loss: profit,
            updated_at: new Date().toISOString()
          })
          .eq('id', trade.id);

        if (updateError) {
          throw updateError;
        }

        await this.logger.log('position_closed', `EOD position closed: ${trade.symbol}`, {
          symbol: trade.symbol,
          entryPrice: trade.price,
          exitPrice: currentPrice,
          profit,
          profitPercent: ((currentPrice - parseFloat(trade.price.toString())) / parseFloat(trade.price.toString()) * 100).toFixed(2),
          reason: 'end_of_day_close',
          bybitOrderId: sellResult.result?.orderId
        });

        console.log(`✅ EOD close completed for ${trade.symbol}: P&L $${profit.toFixed(2)}`);
      } else {
        throw new Error(`Bybit order failed: ${sellResult?.retMsg || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`❌ Error closing position at market:`, error);
      await this.logger.logError(`Failed to close position at market for EOD`, error, {
        tradeId: trade.id,
        symbol: trade.symbol
      });
    }
  }

  private isEndOfDay(config: TradingConfigData): boolean {
    // Simple EOD check - you can make this more sophisticated
    const now = new Date();
    const hour = now.getHours();
    
    // Consider 22:00-23:59 as end of day
    return hour >= 22;
  }
}
