import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from '../TradingLogger';

export class DataConsistencyValidator {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  /**
   * Validate and fix data consistency issues
   */
  async validateDataConsistency(): Promise<void> {
    try {
      console.log('🔍 Validating data consistency...');

      await this.validateTradeData();
      await this.validateSignalData();

      console.log('✅ Data consistency validation completed');

    } catch (error) {
      console.error('❌ Error validating data consistency:', error);
    }
  }

  private async validateTradeData(): Promise<void> {
    // Check for trades with invalid numeric values
    const { data: invalidTrades } = await supabase
      .from('trades')
      .select('id, symbol, price, quantity')
      .eq('user_id', this.userId)
      .or('price.lte.0,quantity.lte.0');

    if (invalidTrades && invalidTrades.length > 0) {
      console.log(`⚠️ Found ${invalidTrades.length} trades with invalid numeric values`);
      await this.logger.log('data_validation', `Found trades with invalid numeric values`, {
        count: invalidTrades.length,
        tradeIds: invalidTrades.map(t => t.id)
      });

      // Close trades with invalid values
      const { error } = await supabase
        .from('trades')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('user_id', this.userId)
        .or('price.lte.0,quantity.lte.0');

      if (!error) {
        console.log('✅ Closed trades with invalid numeric values');
      }
    }
  }

  private async validateSignalData(): Promise<void> {
    // Validate trading signals
    const { data: invalidSignals } = await supabase
      .from('trading_signals')
      .select('id, symbol, price')
      .eq('user_id', this.userId)
      .lte('price', 0);

    if (invalidSignals && invalidSignals.length > 0) {
      console.log(`⚠️ Found ${invalidSignals.length} signals with invalid prices`);
      
      // Remove invalid signals
      const { error } = await supabase
        .from('trading_signals')
        .delete()
        .eq('user_id', this.userId)
        .lte('price', 0);

      if (!error) {
        console.log('✅ Removed signals with invalid prices');
      }
    }
  }
}