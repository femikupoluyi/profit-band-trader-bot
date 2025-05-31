
import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../bybitService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class EndOfDayService {
  private userId: string;
  private config: TradingConfigData;
  private bybitService: BybitService;

  constructor(userId: string, config: TradingConfigData, bybitService: BybitService) {
    this.userId = userId;
    this.config = config;
    this.bybitService = bybitService;
  }

  async closeEndOfDayTrades(): Promise<void> {
    try {
      console.log('Closing profitable trades at end of day...');
      
      const { data: openTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'partial_filled', 'filled']) // Use allowed status values
        .eq('side', 'buy');

      if (error) {
        console.error('Error fetching open trades:', error);
        return;
      }

      if (!openTrades || openTrades.length === 0) {
        console.log('No open trades to evaluate');
        return;
      }

      for (const trade of openTrades) {
        try {
          const { data: currentPrice, error: priceError } = await supabase
            .from('market_data')
            .select('price')
            .eq('symbol', trade.symbol)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (priceError) {
            console.error(`Error fetching price for ${trade.symbol}:`, priceError);
            continue;
          }

          if (!currentPrice) {
            console.log(`No current price data for ${trade.symbol}`);
            continue;
          }

          const entryPrice = parseFloat(trade.price.toString());
          const marketPrice = parseFloat(currentPrice.price.toString());
          const profitLoss = marketPrice - entryPrice;
          const profitPercent = (profitLoss / entryPrice) * 100;

          console.log(`${trade.symbol}: Entry ${entryPrice}, Current ${marketPrice}, P&L ${profitPercent.toFixed(2)}%`);

          if (profitPercent > 0) {
            console.log(`Closing profitable trade for ${trade.symbol}`);
            
            const sellOrder = await this.bybitService.placeOrder({
              symbol: trade.symbol,
              side: 'Sell',
              orderType: 'Market',
              qty: trade.quantity.toString(),
            });

            if (sellOrder.retCode === 0) {
              // Update trade with proper data types using allowed status
              const updateData = {
                status: 'cancelled', // Use allowed status value
                profit_loss: parseFloat(profitLoss.toFixed(8)),
                updated_at: new Date().toISOString(),
              };

              const { error: updateError } = await supabase
                .from('trades')
                .update(updateData)
                .eq('id', trade.id);

              if (updateError) {
                console.error(`Error updating trade ${trade.id}:`, updateError);
              } else {
                await this.logActivity('trade_closed', `Closed profitable position for ${trade.symbol} with ${profitPercent.toFixed(2)}% profit`, {
                  tradeId: trade.id,
                  profitLoss,
                  profitPercent,
                  entryPrice,
                  exitPrice: marketPrice
                });
              }
            } else {
              console.error(`Failed to close position for ${trade.symbol}:`, sellOrder);
              await this.logActivity('execution_error', `Failed to close position for ${trade.symbol}`, { sellOrder });
            }
          } else {
            console.log(`Keeping ${trade.symbol} open (${profitPercent.toFixed(2)}% P&L)`);
          }
        } catch (error) {
          console.error(`Error processing end-of-day for ${trade.symbol}:`, error);
          await this.logActivity('system_error', `Error processing end-of-day for ${trade.symbol}`, { 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      console.error('Error in end-of-day processing:', error);
      await this.logActivity('system_error', 'Error in end-of-day processing', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await supabase
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: type,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}
