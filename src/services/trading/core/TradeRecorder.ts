
import { supabase } from '@/integrations/supabase/client';
import { DataValidationService } from './DataValidationService';
import { TradingLogger } from './TradingLogger';

export class TradeRecorder {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  async recordBuyOrder(
    symbol: string,
    quantity: number,
    entryPrice: number,
    bybitOrderId: string,
    signalId?: string
  ): Promise<void> {
    try {
      console.log(`📝 Recording buy order for ${symbol}`);

      const tradeData = {
        user_id: this.userId,
        symbol: symbol,
        side: 'buy',
        quantity: quantity,
        price: entryPrice,
        status: 'pending',
        order_type: 'limit',
        bybit_order_id: bybitOrderId,
        signal_id: signalId
      };

      // Validate trade data before insertion
      const validation = DataValidationService.validateTradeForDatabase(tradeData);
      if (!validation.isValid) {
        throw new Error(`Trade validation failed: ${validation.errors.join(', ')}`);
      }

      const { data, error } = await supabase
        .from('trades')
        .insert(validation.sanitizedTrade)
        .select()
        .single();

      if (error) {
        console.error(`❌ Database error recording trade:`, error);
        throw error;
      }

      console.log(`✅ Buy order recorded in database: Trade ID ${data.id}`);
      await this.logger.logSuccess(`Buy order recorded for ${symbol}`, {
        tradeId: data.id,
        bybitOrderId,
        quantity,
        entryPrice
      });

    } catch (error) {
      console.error(`❌ Error recording buy order for ${symbol}:`, error);
      await this.logger.logError(`Failed to record buy order for ${symbol}`, error, {
        symbol,
        quantity,
        entryPrice,
        bybitOrderId
      });
      throw error;
    }
  }

  async updateTradeStatus(tradeId: string, status: string, additionalData?: any): Promise<void> {
    try {
      const updateData = {
        status: status,
        updated_at: new Date().toISOString(),
        ...additionalData
      };

      const { error } = await supabase
        .from('trades')
        .update(updateData)
        .eq('id', tradeId)
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

      console.log(`✅ Trade ${tradeId} status updated to ${status}`);
      await this.logger.logSuccess(`Trade status updated`, {
        tradeId,
        newStatus: status,
        additionalData
      });

    } catch (error) {
      console.error(`❌ Error updating trade status:`, error);
      await this.logger.logError(`Failed to update trade status`, error, {
        tradeId,
        status
      });
      throw error;
    }
  }
}
