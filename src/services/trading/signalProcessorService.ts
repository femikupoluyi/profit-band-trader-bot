
import { supabase } from '@/integrations/supabase/client';
import { SignalExecutionService } from './signalExecutionService';

export class SignalProcessorService {
  private userId: string;
  private signalExecutionService: SignalExecutionService;

  constructor(userId: string, signalExecutionService: SignalExecutionService) {
    this.userId = userId;
    this.signalExecutionService = signalExecutionService;
  }

  async processSignals(): Promise<void> {
    try {
      const { data: signals } = await (supabase as any)
        .from('trading_signals')
        .select('*')
        .eq('user_id', this.userId)
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(5);

      if (!signals || signals.length === 0) {
        console.log('No unprocessed signals found');
        return;
      }

      console.log(`Processing ${signals.length} signals...`);
      for (const signal of signals) {
        console.log('Processing signal:', signal);
        await this.signalExecutionService.executeSignal(signal);
      }
    } catch (error) {
      console.error('Error processing signals:', error);
    }
  }
}
