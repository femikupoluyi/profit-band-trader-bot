import { supabase } from '@/integrations/supabase/client';
import { SignalExecutionService } from './core/SignalExecutionService';

export class SignalProcessorService {
  private userId: string;
  private signalExecutionService: SignalExecutionService;

  constructor(userId: string, signalExecutionService: SignalExecutionService) {
    this.userId = userId;
    this.signalExecutionService = signalExecutionService;
  }

  async processSignals(): Promise<void> {
    try {
      console.log('\n🔄 PROCESSING SIGNALS...');
      
      const { data: signals, error } = await supabase
        .from('trading_signals')
        .select('*')
        .eq('user_id', this.userId)
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) {
        console.error('❌ Error fetching signals:', error);
        return;
      }

      if (!signals || signals.length === 0) {
        console.log('📭 No unprocessed signals found');
        return;
      }

      console.log(`📊 Found ${signals.length} unprocessed signals:`);
      signals.forEach((signal, index) => {
        console.log(`  ${index + 1}. ${signal.symbol} - ${signal.signal_type} at $${signal.price} (ID: ${signal.id})`);
      });

      for (const signal of signals) {
        console.log(`\n⚡ EXECUTING SIGNAL ${signal.id} for ${signal.symbol}:`);
        console.log(`  Type: ${signal.signal_type}`);
        console.log(`  Price: $${signal.price}`);
        console.log(`  Confidence: ${signal.confidence}%`);
        console.log(`  Created: ${signal.created_at}`);
        
        try {
          await this.signalExecutionService.executeSignal(signal);
          console.log(`✅ Signal ${signal.id} executed successfully`);
        } catch (error) {
          console.error(`❌ Error executing signal ${signal.id}:`, error);
        }
      }
      
      console.log(`✅ Finished processing ${signals.length} signals\n`);
    } catch (error) {
      console.error('❌ Error in signal processing:', error);
    }
  }
}
