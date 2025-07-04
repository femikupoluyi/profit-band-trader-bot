import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from '../TradingLogger';
import { BybitTransactionRecord } from './BybitOrderFetcher';

export class TradeReconciler {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string, logger: TradingLogger) {
    this.userId = userId;
    this.logger = logger;
  }

  async getLocalTrades(lookbackHours: number): Promise<any[]> {
    const startTime = new Date(Date.now() - (lookbackHours * 60 * 60 * 1000)).toISOString();
    
    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', this.userId)
      .gte('created_at', startTime)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching local trades:', error);
      return [];
    }

    return trades || [];
  }

  findMatchingLocalTrade(execution: BybitTransactionRecord, localTrades: any[]): any | null {
    // Try to match by order ID first
    let match = localTrades.find(trade => 
      trade.bybit_order_id === execution.orderId
    );

    if (match) return match;

    // Try to match by symbol, side, and approximate time/quantity
    const executionTime = new Date(parseInt(execution.execTime));
    const timeWindow = 10 * 60 * 1000; // 10 minutes

    match = localTrades.find(trade => {
      const tradeTime = new Date(trade.created_at);
      const timeDiff = Math.abs(executionTime.getTime() - tradeTime.getTime());
      
      return (
        trade.symbol === execution.symbol &&
        trade.side.toLowerCase() === execution.side.toLowerCase() &&
        timeDiff <= timeWindow &&
        Math.abs(parseFloat(execution.execQty) - trade.quantity) < 0.001
      );
    });

    return match || null;
  }

  async updateExistingTrade(localTrade: any, execution: BybitTransactionRecord): Promise<void> {
    try {
      const updates: any = {
        updated_at: new Date().toISOString()
      };

      // Update with actual execution details
      const executionPrice = parseFloat(execution.execPrice);
      const executionQuantity = parseFloat(execution.execQty);

      if (Math.abs(executionPrice - localTrade.price) > 0.01) {
        updates.price = executionPrice;
      }

      if (Math.abs(executionQuantity - localTrade.quantity) > 0.001) {
        updates.quantity = executionQuantity;
      }

      // Update status based on execution type
      if (execution.execType === 'Trade' && localTrade.status === 'pending') {
        updates.status = 'filled';
      }

      // Store Bybit trade ID for reference
      if (!localTrade.bybit_trade_id) {
        updates.bybit_trade_id = execution.tradeId;
      }

      if (Object.keys(updates).length > 1) { // More than just updated_at
        const { error } = await supabase
          .from('trades')
          .update(updates)
          .eq('id', localTrade.id);

        if (error) {
          console.error(`Error updating trade ${localTrade.id}:`, error);
        } else {
          console.log(`✅ Updated trade ${localTrade.id} with Bybit execution data`);
          await this.logger.log('trade_updated', `Trade updated with Bybit execution data`, {
            tradeId: localTrade.id,
            symbol: execution.symbol,
            bybitTradeId: execution.tradeId,
            updates
          });
        }
      }
    } catch (error) {
      console.error(`Error updating existing trade:`, error);
    }
  }

  async createMissingTradeRecord(execution: BybitTransactionRecord): Promise<void> {
    try {
      console.log(`📝 Creating missing trade record for Bybit execution ${execution.tradeId}`);

      const tradeData = {
        user_id: this.userId,
        symbol: execution.symbol,
        side: execution.side.toLowerCase(),
        order_type: 'limit',
        price: parseFloat(execution.execPrice),
        quantity: parseFloat(execution.execQty),
        status: execution.execType === 'Trade' ? 'filled' : 'pending',
        bybit_order_id: execution.orderId,
        bybit_trade_id: execution.tradeId,
        created_at: new Date(parseInt(execution.execTime)).toISOString()
      };

      const { data: newTrade, error } = await supabase
        .from('trades')
        .insert(tradeData)
        .select()
        .single();

      if (error) {
        console.error('Error creating missing trade record:', error);
      } else {
        console.log(`✅ Created missing trade record: ${newTrade.id}`);
        await this.logger.log('trade_created', `Missing trade record created from Bybit history`, {
          tradeId: newTrade.id,
          symbol: execution.symbol,
          bybitTradeId: execution.tradeId,
          source: 'bybit_reconciliation'
        });
      }
    } catch (error) {
      console.error('Error creating missing trade record:', error);
    }
  }

  async identifyMissingLocalRecords(
    bybitExecutions: BybitTransactionRecord[], 
    localTrades: any[]
  ): Promise<void> {
    console.log('🔍 Identifying missing local records...');
    
    let missingCount = 0;
    
    for (const execution of bybitExecutions) {
      const hasLocal = this.findMatchingLocalTrade(execution, localTrades);
      if (!hasLocal) {
        missingCount++;
        console.log(`⚠️ Missing local record for Bybit trade: ${execution.symbol} ${execution.side} ${execution.execQty} @ ${execution.execPrice}`);
      }
    }

    if (missingCount > 0) {
      await this.logger.log('system_info', `Found ${missingCount} missing local trade records`, {
        missingCount,
        totalBybitExecutions: bybitExecutions.length
      });
    }
  }
}