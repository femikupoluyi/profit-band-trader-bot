
import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './TradingLogger';

export class SignalFetcher {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  async getUnprocessedSignals(limit: number = 3): Promise<any[]> {
    try {
      console.log(`📡 Fetching max ${limit} unprocessed signals for user: ${this.userId}`);

      const { data: signals, error } = await supabase
        .from('trading_signals')
        .select('*')
        .eq('user_id', this.userId)
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching signals:', error);
        await this.logger.logError('Error fetching unprocessed signals', error);
        return [];
      }

      if (!signals || signals.length === 0) {
        console.log('📭 No unprocessed signals found');
        return [];
      }

      console.log(`📡 Found ${signals.length} unprocessed signals (limited to ${limit}):`);
      signals.forEach((signal, index) => {
        console.log(`  ${index + 1}. ${signal.symbol} - ${signal.signal_type} at $${parseFloat(signal.price.toString()).toFixed(6)} (ID: ${signal.id})`);
        console.log(`      Created: ${signal.created_at}, Confidence: ${signal.confidence}`);
      });

      await this.logger.logSystemInfo(`Fetched ${signals.length} unprocessed signals`, {
        signalCount: signals.length,
        signals: signals.map(s => ({
          id: s.id,
          symbol: s.symbol,
          type: s.signal_type,
          price: s.price,
          confidence: s.confidence
        }))
      });

      return signals;

    } catch (error) {
      console.error('❌ Critical error fetching signals:', error);
      await this.logger.logError('Critical error fetching signals', error);
      return [];
    }
  }

  async markSignalAsProcessed(signalId: string): Promise<boolean> {
    try {
      console.log(`✅ Marking signal ${signalId} as processed`);

      const { error } = await supabase
        .from('trading_signals')
        .update({ processed: true, updated_at: new Date().toISOString() })
        .eq('id', signalId);

      if (error) {
        console.error(`❌ Error marking signal ${signalId} as processed:`, error);
        return false;
      }

      console.log(`✅ Signal ${signalId} marked as processed`);
      return true;

    } catch (error) {
      console.error(`❌ Critical error marking signal ${signalId} as processed:`, error);
      return false;
    }
  }

  async getRecentSignals(hours: number = 24): Promise<any[]> {
    try {
      const hoursAgo = new Date();
      hoursAgo.setHours(hoursAgo.getHours() - hours);

      const { data: signals, error } = await supabase
        .from('trading_signals')
        .select('*')
        .eq('user_id', this.userId)
        .gte('created_at', hoursAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching recent signals:', error);
        return [];
      }

      return signals || [];

    } catch (error) {
      console.error('❌ Error fetching recent signals:', error);
      return [];
    }
  }

  /**
   * CRITICAL: Clean up excessive unprocessed signals to prevent backlog buildup
   */
  async cleanupExcessiveSignals(): Promise<void> {
    try {
      console.log('🧹 Checking for excessive unprocessed signals...');
      
      // Get count of unprocessed signals
      const { count } = await supabase
        .from('trading_signals')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('processed', false);

      const unprocessedCount = count || 0;
      console.log(`📊 Found ${unprocessedCount} unprocessed signals`);

      // If we have more than 20 unprocessed signals, mark older ones as processed
      if (unprocessedCount > 20) {
        console.log(`🚨 EXCESSIVE SIGNALS DETECTED: ${unprocessedCount} unprocessed signals - cleaning up older ones`);
        
        // Mark all but the 10 most recent as processed to prevent runaway processing
        const { error } = await supabase
          .from('trading_signals')
          .update({ 
            processed: true, 
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', this.userId)
          .eq('processed', false)
          .not('id', 'in', `(
            SELECT id FROM trading_signals 
            WHERE user_id = '${this.userId}' AND processed = false 
            ORDER BY created_at DESC 
            LIMIT 10
          )`);

        if (error) {
          console.error('❌ Error cleaning up excessive signals:', error);
        } else {
          console.log(`✅ Cleaned up excessive signals - kept only 10 most recent`);
          await this.logger.logSystemInfo('Signal cleanup performed', {
            originalCount: unprocessedCount,
            cleanedUp: unprocessedCount - 10,
            remaining: 10
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Error in signal cleanup:', error);
    }
  }
}
