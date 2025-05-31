
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
      
      const { data: openTrades } = await (supabase as any)
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'filled')
        .eq('side', 'buy');

      if (!openTrades || openTrades.length === 0) {
        console.log('No open trades to evaluate');
        return;
      }

      for (const trade of openTrades) {
        try {
          const { data: currentPrice } = await (supabase as any)
            .from('market_data')
            .select('price')
            .eq('symbol', trade.symbol)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

          if (!currentPrice) continue;

          const entryPrice = parseFloat(trade.price);
          const marketPrice = parseFloat(currentPrice.price);
          const profitPercent = ((marketPrice - entryPrice) / entryPrice) * 100;

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
              await (supabase as any)
                .from('trades')
                .update({
                  status: 'closed',
                  profit_loss: profitPercent,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', trade.id);

              await this.logActivity('trade', `Closed profitable position for ${trade.symbol} with ${profitPercent.toFixed(2)}% profit`);
            }
          } else {
            console.log(`Keeping ${trade.symbol} open (${profitPercent.toFixed(2)}% P&L)`);
          }
        } catch (error) {
          console.error(`Error processing end-of-day for ${trade.symbol}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in end-of-day processing:', error);
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await (supabase as any)
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
