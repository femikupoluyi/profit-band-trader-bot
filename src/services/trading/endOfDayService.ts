
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

  private formatQuantityForSymbol(symbol: string, quantity: number): string {
    // Define precision rules for different symbols based on Bybit requirements
    const precisionRules: Record<string, number> = {
      // Major pairs - typically 3-6 decimal places
      'BTCUSDT': 6,
      'ETHUSDT': 4,
      'BNBUSDT': 3,
      'SOLUSDT': 3,
      'ADAUSDT': 1,
      'XRPUSDT': 1,
      'DOGEUSDT': 0,
      'MATICUSDT': 0,
      'LTCUSDT': 4,
      // Lower value coins - fewer decimal places
      'FETUSDT': 1,
      'POLUSDT': 0,
      'XLMUSDT': 0,
    };

    const decimals = precisionRules[symbol] || 3; // Default to 3 decimal places
    const formattedQty = quantity.toFixed(decimals);
    
    console.log(`Formatting quantity for ${symbol}: ${quantity} -> ${formattedQty} (${decimals} decimals)`);
    return formattedQty;
  }

  private validateOrderValue(symbol: string, quantity: number, price: number): boolean {
    const orderValue = quantity * price;
    const minOrderValue = 1; // Minimum $1 order value for most symbols
    
    console.log(`Order value validation for ${symbol}: ${orderValue.toFixed(2)} USD (min: ${minOrderValue})`);
    
    if (orderValue < minOrderValue) {
      console.log(`❌ Order value ${orderValue.toFixed(2)} below minimum ${minOrderValue}`);
      return false;
    }
    
    return true;
  }

  async closeEndOfDayTrades(): Promise<void> {
    try {
      console.log('Closing profitable trades at end of day...');
      
      const { data: openTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .in('status', ['pending', 'partial_filled', 'filled'])
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
            
            // Format quantity properly for the close order
            const formattedQuantity = this.formatQuantityForSymbol(trade.symbol, trade.quantity);
            
            // Validate minimum order value before placing sell order
            if (!this.validateOrderValue(trade.symbol, trade.quantity, marketPrice)) {
              console.log(`❌ Cannot close ${trade.symbol}: order value below minimum`);
              await this.logActivity('close_rejected', `Cannot close ${trade.symbol}: order value below minimum`, {
                tradeId: trade.id,
                quantity: trade.quantity,
                marketPrice,
                orderValue: trade.quantity * marketPrice
              });
              continue;
            }
            
            const sellOrder = await this.bybitService.placeOrder({
              category: 'spot',
              symbol: trade.symbol,
              side: 'Sell',
              orderType: 'Market',
              qty: formattedQuantity,
            });

            if (sellOrder.retCode === 0) {
              const updateData = {
                status: 'closed' as const,
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
                  exitPrice: marketPrice,
                  formattedQuantity
                });
              }
            } else {
              console.error(`Failed to close position for ${trade.symbol}:`, sellOrder);
              await this.logActivity('execution_error', `Failed to close position for ${trade.symbol}`, { 
                sellOrder,
                reason: `Bybit error: ${sellOrder.retMsg}`,
                retCode: sellOrder.retCode
              });
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
