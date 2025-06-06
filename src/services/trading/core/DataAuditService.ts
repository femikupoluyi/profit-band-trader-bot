
import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './TradingLogger';

interface AuditIssue {
  issueType: string;
  tradeId: string;
  symbol: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
}

export class DataAuditService {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  async performFullAudit(): Promise<AuditIssue[]> {
    console.log('🔍 Starting comprehensive data audit...');
    const issues: AuditIssue[] = [];

    try {
      // Audit 1: Check for missing buy_fill_price on filled buy orders
      const missingBuyFillPrice = await this.auditMissingBuyFillPrice();
      issues.push(...missingBuyFillPrice);

      // Audit 2: Check for inconsistent order IDs
      const inconsistentOrderIds = await this.auditInconsistentOrderIds();
      issues.push(...inconsistentOrderIds);

      // Audit 3: Check for missing sell_status
      const missingSellStatus = await this.auditMissingSellStatus();
      issues.push(...missingSellStatus);

      // Audit 4: Check for orphaned trades
      const orphanedTrades = await this.auditOrphanedTrades();
      issues.push(...orphanedTrades);

      // Log audit results
      await this.logger.logSuccess('Data audit completed', {
        totalIssues: issues.length,
        criticalIssues: issues.filter(i => i.severity === 'critical').length,
        warningIssues: issues.filter(i => i.severity === 'warning').length
      });

      return issues;
    } catch (error) {
      await this.logger.logError('Data audit failed', error);
      throw error;
    }
  }

  private async auditMissingBuyFillPrice(): Promise<AuditIssue[]> {
    const { data: trades, error } = await supabase
      .from('trades')
      .select('id, symbol, side, status, buy_fill_price, price')
      .eq('user_id', this.userId)
      .eq('side', 'buy')
      .in('status', ['filled', 'closed'])
      .or('buy_fill_price.is.null,buy_fill_price.eq.0');

    if (error) {
      console.error('Error auditing missing buy_fill_price:', error);
      return [];
    }

    return (trades || []).map(trade => ({
      issueType: 'missing_buy_fill_price',
      tradeId: trade.id,
      symbol: trade.symbol,
      description: `Buy trade (${trade.status}) missing buy_fill_price`,
      severity: 'critical' as const
    }));
  }

  private async auditInconsistentOrderIds(): Promise<AuditIssue[]> {
    const { data: trades, error } = await supabase
      .from('trades')
      .select('id, symbol, side, bybit_order_id, buy_order_id')
      .eq('user_id', this.userId)
      .eq('side', 'buy')
      .not('bybit_order_id', 'is', null)
      .is('buy_order_id', null);

    if (error) {
      console.error('Error auditing inconsistent order IDs:', error);
      return [];
    }

    return (trades || []).map(trade => ({
      issueType: 'inconsistent_order_ids',
      tradeId: trade.id,
      symbol: trade.symbol,
      description: 'Trade has bybit_order_id but missing buy_order_id',
      severity: 'warning' as const
    }));
  }

  private async auditMissingSellStatus(): Promise<AuditIssue[]> {
    const { data: trades, error } = await supabase
      .from('trades')
      .select('id, symbol, sell_status')
      .eq('user_id', this.userId)
      .is('sell_status', null);

    if (error) {
      console.error('Error auditing missing sell_status:', error);
      return [];
    }

    return (trades || []).map(trade => ({
      issueType: 'missing_sell_status',
      tradeId: trade.id,
      symbol: trade.symbol,
      description: 'Trade missing sell_status field',
      severity: 'info' as const
    }));
  }

  private async auditOrphanedTrades(): Promise<AuditIssue[]> {
    const { data: trades, error } = await supabase
      .from('trades')
      .select('id, symbol, status, created_at')
      .eq('user_id', this.userId)
      .eq('status', 'pending')
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Older than 24 hours

    if (error) {
      console.error('Error auditing orphaned trades:', error);
      return [];
    }

    return (trades || []).map(trade => ({
      issueType: 'orphaned_trades',
      tradeId: trade.id,
      symbol: trade.symbol,
      description: 'Trade stuck in pending status for >24 hours',
      severity: 'warning' as const
    }));
  }

  async fixIssues(issues: AuditIssue[]): Promise<void> {
    console.log(`🔧 Fixing ${issues.length} data issues...`);

    for (const issue of issues) {
      try {
        await this.fixSingleIssue(issue);
      } catch (error) {
        await this.logger.logError(`Failed to fix issue ${issue.issueType}`, error, {
          tradeId: issue.tradeId,
          symbol: issue.symbol
        });
      }
    }
  }

  private async fixSingleIssue(issue: AuditIssue): Promise<void> {
    switch (issue.issueType) {
      case 'missing_buy_fill_price':
        await this.fixMissingBuyFillPrice(issue.tradeId);
        break;
      case 'inconsistent_order_ids':
        await this.fixInconsistentOrderIds(issue.tradeId);
        break;
      case 'missing_sell_status':
        await this.fixMissingSellStatus(issue.tradeId);
        break;
      default:
        console.log(`No automatic fix available for issue type: ${issue.issueType}`);
    }
  }

  private async fixMissingBuyFillPrice(tradeId: string): Promise<void> {
    const { data: trade } = await supabase
      .from('trades')
      .select('price')
      .eq('id', tradeId)
      .single();

    if (trade) {
      const { error } = await supabase
        .from('trades')
        .update({
          buy_fill_price: trade.price,
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId);

      if (!error) {
        await this.logger.logSuccess(`Fixed missing buy_fill_price for trade ${tradeId}`);
      }
    }
  }

  private async fixInconsistentOrderIds(tradeId: string): Promise<void> {
    const { data: trade } = await supabase
      .from('trades')
      .select('bybit_order_id')
      .eq('id', tradeId)
      .single();

    if (trade && trade.bybit_order_id) {
      const { error } = await supabase
        .from('trades')
        .update({
          buy_order_id: trade.bybit_order_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId);

      if (!error) {
        await this.logger.logSuccess(`Fixed inconsistent order IDs for trade ${tradeId}`);
      }
    }
  }

  private async fixMissingSellStatus(tradeId: string): Promise<void> {
    const { error } = await supabase
      .from('trades')
      .update({
        sell_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', tradeId);

    if (!error) {
      await this.logger.logSuccess(`Fixed missing sell_status for trade ${tradeId}`);
    }
  }
}
