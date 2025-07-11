import { supabase } from '@/integrations/supabase/client';
import { BybitService } from '../../../bybitService';
import { TradingLogger } from '../TradingLogger';
import { BybitOrderFetcher, BybitTransactionRecord } from './BybitOrderFetcher';
import { TradeReconciler } from './TradeReconciler';

interface ReconciliationReport {
  summary: {
    bybitOrdersCount: number;
    localTradesCount: number;
    matchedTrades: number;
    missingFromLocal: number;
    extraInLocal: number;
    statusMismatches: number;
    priceMismatches: number;
  };
  details: {
    missingFromLocal: BybitTransactionRecord[];
    extraInLocal: any[];
    statusMismatches: Array<{
      local: any;
      bybit: BybitTransactionRecord;
      issue: string;
    }>;
    priceMismatches: Array<{
      local: any;
      bybit: BybitTransactionRecord;
      priceDiff: number;
    }>;
  };
  recommendations: string[];
}

export class ComprehensiveReconciliation {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private orderFetcher: BybitOrderFetcher;
  private reconciler: TradeReconciler;

  constructor(userId: string, bybitService: BybitService, logger: TradingLogger) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = logger;
    this.orderFetcher = new BybitOrderFetcher(bybitService, logger);
    this.reconciler = new TradeReconciler(userId, logger);
  }

  async performComprehensiveReconciliation(lookbackHours: number = 168): Promise<ReconciliationReport> {
    console.log(`🔍 Starting comprehensive reconciliation for past ${lookbackHours} hours...`);
    
    try {
      // Step 1: Fetch Bybit data
      console.log('📊 Step 1: Fetching Bybit order history...');
      const bybitOrders = await this.orderFetcher.getBybitExecutionHistory(lookbackHours);
      
      // Step 2: Fetch local trades
      console.log('💾 Step 2: Fetching local trades...');
      const localTrades = await this.reconciler.getLocalTrades(lookbackHours);
      
      // Step 3: Perform detailed analysis
      console.log('🔬 Step 3: Performing detailed analysis...');
      const report = await this.analyzeDiscrepancies(bybitOrders, localTrades);
      
      // Step 4: Log the analysis
      await this.logger.log('reconciliation_analysis', 'Comprehensive reconciliation completed', {
        lookbackHours,
        summary: report.summary,
        detailsCount: {
          missingFromLocal: report.details.missingFromLocal.length,
          extraInLocal: report.details.extraInLocal.length,
          statusMismatches: report.details.statusMismatches.length,
          priceMismatches: report.details.priceMismatches.length
        }
      });
      
      return report;
      
    } catch (error) {
      console.error('❌ Error during comprehensive reconciliation:', error);
      await this.logger.logError('Comprehensive reconciliation failed', error);
      throw error;
    }
  }

  private async analyzeDiscrepancies(
    bybitOrders: BybitTransactionRecord[], 
    localTrades: any[]
  ): Promise<ReconciliationReport> {
    
    const report: ReconciliationReport = {
      summary: {
        bybitOrdersCount: bybitOrders.length,
        localTradesCount: localTrades.length,
        matchedTrades: 0,
        missingFromLocal: 0,
        extraInLocal: 0,
        statusMismatches: 0,
        priceMismatches: 0
      },
      details: {
        missingFromLocal: [],
        extraInLocal: [],
        statusMismatches: [],
        priceMismatches: []
      },
      recommendations: []
    };

    console.log(`📊 Analyzing ${bybitOrders.length} Bybit orders vs ${localTrades.length} local trades`);

    // Track which local trades have been matched
    const matchedLocalTradeIds = new Set<string>();

    // Analyze each Bybit order
    for (const bybitOrder of bybitOrders) {
      const matchingLocal = this.reconciler.findMatchingLocalTrade(bybitOrder, localTrades);
      
      if (!matchingLocal) {
        // Missing from local database
        report.details.missingFromLocal.push(bybitOrder);
        report.summary.missingFromLocal++;
        console.log(`⚠️ Missing from local: ${bybitOrder.symbol} ${bybitOrder.side} ${bybitOrder.execQty} @ ${bybitOrder.execPrice} (Bybit ID: ${bybitOrder.orderId})`);
      } else {
        // Found a match - check for discrepancies
        matchedLocalTradeIds.add(matchingLocal.id);
        report.summary.matchedTrades++;
        
        // Check status consistency
        const bybitStatus = bybitOrder.execType === 'Trade' ? 'filled' : 'pending';
        if (matchingLocal.status !== bybitStatus) {
          report.details.statusMismatches.push({
            local: matchingLocal,
            bybit: bybitOrder,
            issue: `Local status: ${matchingLocal.status}, Bybit status: ${bybitStatus}`
          });
          report.summary.statusMismatches++;
          console.log(`🔄 Status mismatch: ${bybitOrder.symbol} - Local: ${matchingLocal.status}, Bybit: ${bybitStatus}`);
        }
        
        // Check price consistency
        const bybitPrice = parseFloat(bybitOrder.execPrice);
        const localPrice = parseFloat(matchingLocal.price);
        const priceDiff = Math.abs(bybitPrice - localPrice);
        if (priceDiff > 0.01) { // More than 1 cent difference
          report.details.priceMismatches.push({
            local: matchingLocal,
            bybit: bybitOrder,
            priceDiff
          });
          report.summary.priceMismatches++;
          console.log(`💰 Price mismatch: ${bybitOrder.symbol} - Local: ${localPrice}, Bybit: ${bybitPrice}, Diff: ${priceDiff}`);
        }
      }
    }

    // Find local trades that don't match any Bybit order
    for (const localTrade of localTrades) {
      if (!matchedLocalTradeIds.has(localTrade.id)) {
        report.details.extraInLocal.push(localTrade);
        report.summary.extraInLocal++;
        console.log(`🆘 Extra in local: ${localTrade.symbol} ${localTrade.side} ${localTrade.quantity} @ ${localTrade.price} (ID: ${localTrade.id})`);
      }
    }

    // Generate recommendations based on findings
    this.generateRecommendations(report);

    return report;
  }

  private generateRecommendations(report: ReconciliationReport): void {
    const { summary, details } = report;
    
    if (summary.missingFromLocal > 0) {
      report.recommendations.push(
        `🔄 Import ${summary.missingFromLocal} missing trades from Bybit to local database`
      );
    }
    
    if (summary.extraInLocal > 0) {
      report.recommendations.push(
        `🗑️ Review ${summary.extraInLocal} local trades that don't exist on Bybit - may be test/stale data`
      );
    }
    
    if (summary.statusMismatches > 0) {
      report.recommendations.push(
        `⚡ Fix ${summary.statusMismatches} status mismatches - sync trade statuses with Bybit`
      );
      
      // Analyze specific status issues
      const buyOrdersMarkedClosed = details.statusMismatches.filter(mismatch => 
        mismatch.local.side === 'buy' && mismatch.local.status === 'closed'
      );
      
      if (buyOrdersMarkedClosed.length > 0) {
        report.recommendations.push(
          `🎯 CRITICAL: ${buyOrdersMarkedClosed.length} BUY orders incorrectly marked as 'closed' - should be 'filled' (active positions)`
        );
      }
    }
    
    if (summary.priceMismatches > 0) {
      report.recommendations.push(
        `💲 Update ${summary.priceMismatches} trades with correct execution prices from Bybit`
      );
    }
    
    // Analyze profit/loss logic issues
    const buyTradesWithProfit = details.extraInLocal.filter(trade => 
      trade.side === 'buy' && trade.profit_loss && trade.profit_loss !== 0
    );
    
    if (buyTradesWithProfit.length > 0) {
      report.recommendations.push(
        `🚨 ARCHITECTURE ISSUE: ${buyTradesWithProfit.length} BUY trades have profit/loss values - profit should only be on SELL trades`
      );
    }
    
    // Check for unclosed positions
    const activeBuyTrades = details.extraInLocal.filter(trade => 
      trade.side === 'buy' && ['filled', 'partial_filled'].includes(trade.status)
    );
    
    if (activeBuyTrades.length > 0) {
      report.recommendations.push(
        `📊 Found ${activeBuyTrades.length} active BUY positions - verify these represent actual holdings`
      );
    }
  }

  async printDetailedReport(report: ReconciliationReport): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE RECONCILIATION REPORT');
    console.log('='.repeat(80));
    
    // Summary
    console.log('\n📈 SUMMARY:');
    console.log(`  Bybit Orders: ${report.summary.bybitOrdersCount}`);
    console.log(`  Local Trades: ${report.summary.localTradesCount}`);
    console.log(`  Matched: ${report.summary.matchedTrades}`);
    console.log(`  Missing from Local: ${report.summary.missingFromLocal}`);
    console.log(`  Extra in Local: ${report.summary.extraInLocal}`);
    console.log(`  Status Mismatches: ${report.summary.statusMismatches}`);
    console.log(`  Price Mismatches: ${report.summary.priceMismatches}`);
    
    // Recommendations
    console.log('\n🎯 RECOMMENDATIONS:');
    report.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
    
    // Details (first few items only to avoid spam)
    if (report.details.missingFromLocal.length > 0) {
      console.log('\n⚠️ SAMPLE MISSING FROM LOCAL:');
      report.details.missingFromLocal.slice(0, 5).forEach(order => {
        console.log(`  ${order.symbol} ${order.side} ${order.execQty} @ ${order.execPrice} (${order.orderId})`);
      });
      if (report.details.missingFromLocal.length > 5) {
        console.log(`  ... and ${report.details.missingFromLocal.length - 5} more`);
      }
    }
    
    if (report.details.statusMismatches.length > 0) {
      console.log('\n🔄 SAMPLE STATUS MISMATCHES:');
      report.details.statusMismatches.slice(0, 5).forEach(mismatch => {
        console.log(`  ${mismatch.local.symbol}: ${mismatch.issue}`);
      });
      if (report.details.statusMismatches.length > 5) {
        console.log(`  ... and ${report.details.statusMismatches.length - 5} more`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
  }
}