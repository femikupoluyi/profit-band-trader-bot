
import { supabase } from '@/integrations/supabase/client';
import { SignalExecutionService } from './core/SignalExecutionService';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';

export class SignalProcessorService {
  private userId: string;
  private signalExecutionService: SignalExecutionService;
  private config: TradingConfigData;

  constructor(userId: string, signalExecutionService: SignalExecutionService, config: TradingConfigData) {
    this.userId = userId;
    this.signalExecutionService = signalExecutionService;
    this.config = config;
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

      // Execute signals using the config
      await this.signalExecutionService.executeSignal(this.config);
      
      console.log(`✅ Finished processing ${signals.length} signals\n`);
    } catch (error) {
      console.error('❌ Error in signal processing:', error);
    }
  }
}
