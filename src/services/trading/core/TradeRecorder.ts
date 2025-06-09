
import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './TradingLogger';
import { DataValidationService } from './DataValidationService';

interface TradeData {
  userId: string;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  price: number;
  quantity: number;
  status: string;
  bybitOrderId?: string;
  bybitTradeId?: string;
  buyFillPrice?: number;
  profitLoss?: number;
}

export class TradeRecorder {
  private static logger: TradingLogger;

  private static getLogger(userId: string): TradingLogger {
    if (!this.logger) {
      this.logger = new TradingLogger(userId);
    }
    return this.logger;
  }

  /**
   * Create a new trade record with enhanced validation
   */
  static async createTradeRecord(tradeData: TradeData): Promise<any> {
    try {
      const logger = this.getLogger(tradeData.userId);
      
      console.log(`📝 Creating trade record:`, {
        symbol: tradeData.symbol,
        side: tradeData.side,
        price: tradeData.price,
        quantity: tradeData.quantity,
        status: tradeData.status
      });

      // Prepare trade object for validation
      const tradeForValidation = {
        user_id: tradeData.userId,
        symbol: tradeData.symbol,
        side: tradeData.side,
        order_type: tradeData.orderType,
        price: tradeData.price,
        quantity: tradeData.quantity,
        status: tradeData.status,
        bybit_order_id: tradeData.bybitOrderId,
        bybit_trade_id: tradeData.bybitTradeId,
        buy_fill_price: tradeData.buyFillPrice,
        profit_loss: tradeData.profitLoss
      };

      // Validate trade data before database insertion
      const validation = DataValidationService.validateTradeForDatabase(tradeForValidation);
      if (!validation.isValid) {
        const errorMessage = `Trade validation failed: ${validation.errors.join(', ')}`;
        console.error('❌', errorMessage);
        await logger.logError('Trade validation failed', errorMessage, { tradeData });
        throw new Error(errorMessage);
      }

      // Insert the validated trade into database
      const { data: trade, error } = await supabase
        .from('trades')
        .insert([validation.sanitizedTrade])
        .select()
        .single();

      if (error) {
        console.error('❌ Database error creating trade:', error);
        await logger.logError('Database error creating trade', error, { tradeData });
        throw error;
      }

      console.log(`✅ Trade record created successfully:`, trade.id);
      await logger.logSuccess(`Trade record created for ${tradeData.symbol}`, {
        tradeId: trade.id,
        symbol: tradeData.symbol,
        side: tradeData.side,
        price: validation.sanitizedTrade.price,
        quantity: validation.sanitizedTrade.quantity
      });

      return trade;

    } catch (error) {
      console.error(`❌ Error creating trade record:`, error);
      const logger = this.getLogger(tradeData.userId);
      await logger.logError('Error creating trade record', error, { tradeData });
      throw error;
    }
  }

  /**
   * Update an existing trade record with validation
   */
  static async updateTradeRecord(
    tradeId: string, 
    updateData: Partial<TradeData>, 
    userId: string
  ): Promise<any> {
    try {
      const logger = this.getLogger(userId);
      
      console.log(`📝 Updating trade record ${tradeId}:`, updateData);

      // Validate numeric fields if they exist in updateData
      const sanitizedUpdate: any = {};
      
      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (['price', 'quantity', 'buyFillPrice', 'profitLoss'].includes(key)) {
            const numericValue = typeof value === 'string' ? parseFloat(value) : Number(value);
            if (!isNaN(numericValue) && isFinite(numericValue)) {
              // Convert camelCase to snake_case for database
              const dbKey = key === 'buyFillPrice' ? 'buy_fill_price' : 
                           key === 'profitLoss' ? 'profit_loss' :
                           key === 'orderType' ? 'order_type' :
                           key === 'bybitOrderId' ? 'bybit_order_id' :
                           key === 'bybitTradeId' ? 'bybit_trade_id' : key;
              sanitizedUpdate[dbKey] = numericValue;
            }
          } else {
            // Handle non-numeric fields
            const dbKey = key === 'orderType' ? 'order_type' :
                         key === 'bybitOrderId' ? 'bybit_order_id' :
                         key === 'bybitTradeId' ? 'bybit_trade_id' : key;
            sanitizedUpdate[dbKey] = value;
          }
        }
      });

      // Always update the updated_at timestamp
      sanitizedUpdate.updated_at = new Date().toISOString();

      const { data: trade, error } = await supabase
        .from('trades')
        .update(sanitizedUpdate)
        .eq('id', tradeId)
        .eq('user_id', userId) // Ensure user can only update their own trades
        .select()
        .single();

      if (error) {
        console.error('❌ Database error updating trade:', error);
        await logger.logError('Database error updating trade', error, { tradeId, updateData });
        throw error;
      }

      if (!trade) {
        const errorMessage = `Trade ${tradeId} not found or not owned by user`;
        console.error('❌', errorMessage);
        await logger.logError('Trade not found for update', errorMessage, { tradeId, userId });
        throw new Error(errorMessage);
      }

      console.log(`✅ Trade record updated successfully:`, trade.id);
      await logger.logSuccess(`Trade record updated for ${trade.symbol}`, {
        tradeId: trade.id,
        updateData: sanitizedUpdate
      });

      return trade;

    } catch (error) {
      console.error(`❌ Error updating trade record:`, error);
      const logger = this.getLogger(userId);
      await logger.logError('Error updating trade record', error, { tradeId, updateData });
      throw error;
    }
  }

  /**
   * Get trade by ID with validation
   */
  static async getTradeById(tradeId: string, userId: string): Promise<any> {
    try {
      if (!tradeId || typeof tradeId !== 'string') {
        throw new Error('Invalid trade ID');
      }

      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID');
      }

      const { data: trade, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('❌ Database error fetching trade:', error);
        throw error;
      }

      return trade;

    } catch (error) {
      console.error(`❌ Error fetching trade ${tradeId}:`, error);
      throw error;
    }
  }
}
