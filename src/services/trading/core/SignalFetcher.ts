
import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './TradingLogger';

export class SignalFetcher {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  async getUnprocessedSignals(): Promise<any[]> {
    try {
      const { data: signals, error } = await supabase
        .from('trading_signals')
        .select('*')
        .eq('user_id', this.userId)
        .eq('processed', false)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error fetching signals:', error);
        await this.logger.logError('Error fetching unprocessed signals', error);
        return [];
      }

      console.log(`📋 Database query returned ${signals?.length || 0} unprocessed signals`);
      return signals || [];
    } catch (error) {
      console.error('❌ Database error fetching signals:', error);
      await this.logger.logError('Database error fetching signals', error);
      return [];
    }
  }

  async markSignalAsProcessed(signalId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('trading_signals')
        .update({ 
          processed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', signalId);

      if (error) {
        console.error(`❌ Error marking signal ${signalId} as processed:`, error);
        await this.logger.logError(`Error marking signal as processed`, error, { signalId });
      } else {
        console.log(`✅ Signal ${signalId} marked as processed`);
      }
    } catch (error) {
      console.error(`❌ Database error marking signal ${signalId} as processed:`, error);
      await this.logger.logError('Database error marking signal as processed', error, { signalId });
    }
  }
}
