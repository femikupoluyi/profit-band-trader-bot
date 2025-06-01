
import { supabase } from '@/integrations/supabase/client';
import { TestResult } from './types';
import { TEST_NAMES, TEST_SYMBOLS } from './testConstants';

export const runSignalGenerationTest = async (userId: string): Promise<TestResult> => {
  try {
    const { data: signal, error: signalError } = await supabase
      .from('trading_signals')
      .insert({
        user_id: userId,
        symbol: TEST_SYMBOLS.SOL,
        signal_type: 'buy',
        price: 150,
        confidence: 0.8,
        reasoning: 'Test signal for system verification',
        processed: false,
      })
      .select()
      .single();
    
    if (signalError) {
      return { 
        test: TEST_NAMES.SIGNAL_GENERATION, 
        status: 'error', 
        message: `❌ Signal creation failed: ${signalError.message}` 
      };
    } else {
      // Clean up test signal
      await supabase
        .from('trading_signals')
        .delete()
        .eq('id', signal.id);
      
      return { 
        test: TEST_NAMES.SIGNAL_GENERATION, 
        status: 'success', 
        message: '✅ Test signal created successfully' 
      };
    }
  } catch (error) {
    return { 
      test: TEST_NAMES.SIGNAL_GENERATION, 
      status: 'error', 
      message: `❌ Signal test failed: ${error}` 
    };
  }
};
