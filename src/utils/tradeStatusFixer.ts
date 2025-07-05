import { supabase } from '@/integrations/supabase/client';

/**
 * Utility to fix incorrectly closed trades
 * This fixes trades that were marked as 'closed' but should be 'filled' (active positions)
 */
export async function fixIncorrectlyClosedTrades(userId: string): Promise<{
  success: boolean;
  updatedCount: number;
  message: string;
}> {
  try {
    console.log('🔧 Fixing incorrectly closed trades...');
    
    // Get ALL buy trades that are marked as closed
    // BUY orders should NEVER be marked as 'closed' - they should be 'filled' until sold
    const { data: closedBuyTrades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .eq('side', 'buy')
      .eq('status', 'closed');
    
    if (error) {
      console.error('❌ Error fetching closed trades:', error);
      return {
        success: false,
        updatedCount: 0,
        message: `Error fetching trades: ${error.message}`
      };
    }
    
    if (!closedBuyTrades || closedBuyTrades.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        message: 'No incorrectly closed trades found'
      };
    }
    
    console.log(`📋 Found ${closedBuyTrades.length} potentially incorrectly closed buy trades`);
    
    // Update ALL closed buy trades back to 'filled' status
    // BUY orders should be 'filled' (active) until there's evidence of a sell
    const { data: updatedTrades, error: updateError } = await supabase
      .from('trades')
      .update({
        status: 'filled',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('side', 'buy')
      .eq('status', 'closed')
      .select('id, symbol');
    
    if (updateError) {
      console.error('❌ Error updating trades:', updateError);
      return {
        success: false,
        updatedCount: 0,
        message: `Error updating trades: ${updateError.message}`
      };
    }
    
    const updatedCount = updatedTrades?.length || 0;
    
    console.log(`✅ Fixed ${updatedCount} incorrectly closed trades`);
    
    // Log the fix action
    await supabase
      .from('trading_logs')
      .insert({
        user_id: userId,
        log_type: 'system_fix',
        message: `Fixed ${updatedCount} incorrectly closed trades`,
        data: {
          action: 'fix_closed_trades',
          updatedCount,
          symbols: updatedTrades?.map(t => t.symbol) || []
        }
      });
    
    return {
      success: true,
      updatedCount,
      message: `Successfully fixed ${updatedCount} incorrectly closed trades`
    };
    
  } catch (error) {
    console.error('❌ Error in fixIncorrectlyClosedTrades:', error);
    return {
      success: false,
      updatedCount: 0,
      message: `Unexpected error: ${error.message}`
    };
  }
}