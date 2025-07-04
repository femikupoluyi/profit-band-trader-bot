import { supabase } from '@/integrations/supabase/client';

export class SignalMarker {
  
  static async markSignalAsProcessed(signalId: string): Promise<void> {
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
      } else {
        console.log(`✅ Signal ${signalId} marked as processed`);
      }
    } catch (error) {
      console.error(`❌ Critical error marking signal ${signalId} as processed:`, error);
    }
  }
}