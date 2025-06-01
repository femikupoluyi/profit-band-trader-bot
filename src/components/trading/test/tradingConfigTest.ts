
import { supabase } from '@/integrations/supabase/client';
import { TestResult } from './types';
import { TEST_NAMES } from './testConstants';

export const runTradingConfigTest = async (userId: string): Promise<TestResult> => {
  try {
    const { data: config } = await supabase
      .from('trading_configs')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (config && config.is_active) {
      return { 
        test: TEST_NAMES.TRADING_CONFIG, 
        status: 'success', 
        message: '✅ Trading config active' 
      };
    } else {
      return { 
        test: TEST_NAMES.TRADING_CONFIG, 
        status: 'error', 
        message: '❌ Trading config not active' 
      };
    }
  } catch (error) {
    return { 
      test: TEST_NAMES.TRADING_CONFIG, 
      status: 'error', 
      message: `❌ Trading config test failed: ${error}` 
    };
  }
};
