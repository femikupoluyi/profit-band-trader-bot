import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '@/services/bybitService';
import { TradingLogger } from '@/services/trading/core/TradingLogger';
import { ComprehensiveReconciliation } from '@/services/trading/core/reconciliation/ComprehensiveReconciliation';

export async function performReconciliationAnalysis(userId: string, lookbackHours: number = 168): Promise<{
  success: boolean;
  report?: any;
  error?: string;
}> {
  try {
    console.log('🔍 Starting comprehensive reconciliation analysis...');
    
    // Step 1: Get user's API credentials
    const { data: credentials, error: credError } = await supabase
      .from('api_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (credError || !credentials) {
      return {
        success: false,
        error: 'No active API credentials found. Please configure your Bybit API credentials first.'
      };
    }

    // Step 2: Initialize services
    const bybitService = new BybitService(
      credentials.api_key,
      credentials.api_secret,
      credentials.testnet || true,
      credentials.api_url
    );

    const logger = new TradingLogger(userId);

    // Step 3: Perform comprehensive reconciliation
    const reconciliation = new ComprehensiveReconciliation(userId, bybitService, logger);
    
    console.log(`📊 Fetching data from Bybit and comparing with local database (${lookbackHours} hours)...`);
    const report = await reconciliation.performComprehensiveReconciliation(lookbackHours);
    
    // Step 4: Print detailed report to console
    await reconciliation.printDetailedReport(report);
    
    return {
      success: true,
      report
    };
    
  } catch (error) {
    console.error('❌ Error during reconciliation analysis:', error);
    return {
      success: false,
      error: `Analysis failed: ${error.message}`
    };
  }
}

// Function to run a quick status check on current database state
export async function analyzeCurrentDatabaseState(userId: string): Promise<{
  summary: any;
  issues: string[];
}> {
  console.log('🔍 Analyzing current database state...');
  
  const issues: string[] = [];
  
  // Get all trades from last 7 days
  const { data: trades, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    issues.push(`Database query error: ${error.message}`);
    return { summary: {}, issues };
  }

  if (!trades) {
    issues.push('No trades found in database');
    return { summary: { totalTrades: 0 }, issues };
  }

  // Analyze the data
  const summary = {
    totalTrades: trades.length,
    buyTrades: trades.filter(t => t.side === 'buy').length,
    sellTrades: trades.filter(t => t.side === 'sell').length,
    
    // Status analysis
    pendingTrades: trades.filter(t => t.status === 'pending').length,
    filledTrades: trades.filter(t => t.status === 'filled').length,
    closedTrades: trades.filter(t => t.status === 'closed').length,
    
    // Specific issues
    closedBuyTrades: trades.filter(t => t.side === 'buy' && t.status === 'closed').length,
    activeBuyTrades: trades.filter(t => t.side === 'buy' && ['filled', 'partial_filled'].includes(t.status)).length,
    
    // P&L analysis
    buyTradesWithProfit: trades.filter(t => t.side === 'buy' && t.profit_loss && t.profit_loss !== 0).length,
    sellTradesWithProfit: trades.filter(t => t.side === 'sell' && t.profit_loss && t.profit_loss !== 0).length,
    totalProfitOnBuys: trades.filter(t => t.side === 'buy').reduce((sum, t) => sum + (t.profit_loss || 0), 0),
    totalProfitOnSells: trades.filter(t => t.side === 'sell').reduce((sum, t) => sum + (t.profit_loss || 0), 0),
  };

  // Identify issues
  if (summary.closedBuyTrades > 0) {
    issues.push(`🚨 CRITICAL: ${summary.closedBuyTrades} BUY trades are marked as 'closed' - these should be 'filled' (active positions)`);
  }

  if (summary.buyTradesWithProfit > 0) {
    issues.push(`🚨 ARCHITECTURE ISSUE: ${summary.buyTradesWithProfit} BUY trades have profit/loss values - profit should only be recorded on SELL trades`);
  }

  if (summary.activeBuyTrades === 0 && summary.closedBuyTrades > 0) {
    issues.push(`⚠️ Suspicious: No active BUY trades but ${summary.closedBuyTrades} closed BUY trades - all positions appear closed`);
  }

  if (summary.totalProfitOnBuys > 0 && summary.totalProfitOnSells === 0) {
    issues.push(`💰 P&L LOGIC ERROR: All profit ($${summary.totalProfitOnBuys.toFixed(2)}) is on BUY trades, $0 on SELL trades`);
  }

  console.log('📊 Database State Analysis:', summary);
  console.log('🚨 Issues Found:', issues);

  return { summary, issues };
}