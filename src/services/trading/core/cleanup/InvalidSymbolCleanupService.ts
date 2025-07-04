import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from '../TradingLogger';

export class InvalidSymbolCleanupService {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  /**
   * Mark trades for invalid symbols as closed
   */
  async markInvalidSymbolTradesAsClosed(validSymbols: string[]): Promise<void> {
    try {
      if (validSymbols.length === 0) {
        console.log('⚠️ No valid symbols configured, skipping invalid symbol cleanup');
        return;
      }

      console.log('🔄 Marking trades for invalid symbols as closed...');

      const { data: invalidTrades, error: fetchError } = await supabase
        .from('trades')
        .select('id, symbol, side, status')
        .eq('user_id', this.userId)
        .not('symbol', 'in', `(${validSymbols.map(s => `"${s}"`).join(',')})`)
        .in('status', ['pending', 'filled', 'partial_filled']);

      if (fetchError) {
        console.error('❌ Error fetching invalid symbol trades:', fetchError);
        return;
      }

      if (!invalidTrades || invalidTrades.length === 0) {
        console.log('📭 No invalid symbol trades to close');
        return;
      }

      console.log(`🎯 Found ${invalidTrades.length} trades for invalid symbols to close:`, 
        invalidTrades.map(t => t.symbol));

      const { error: updateError } = await supabase
        .from('trades')
        .update({ 
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', this.userId)
        .not('symbol', 'in', `(${validSymbols.map(s => `"${s}"`).join(',')})`)
        .in('status', ['pending', 'filled', 'partial_filled']);

      if (updateError) {
        console.error('❌ Error marking invalid symbol trades as closed:', updateError);
      } else {
        console.log(`✅ Marked ${invalidTrades.length} invalid symbol trades as closed`);
        await this.logger.log('data_cleanup', `Marked ${invalidTrades.length} invalid symbol trades as closed`, {
          count: invalidTrades.length,
          invalidSymbols: [...new Set(invalidTrades.map(t => t.symbol))],
          validSymbols,
          type: 'invalid_symbols_cleanup'
        });
      }
    } catch (error) {
      console.error('❌ Error marking invalid symbol trades as closed:', error);
    }
  }
}