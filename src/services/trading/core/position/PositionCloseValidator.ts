
import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from '../TradingLogger';

export class PositionCloseValidator {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string, logger: TradingLogger) {
    this.userId = userId;
    this.logger = logger;
  }

  async validateCloseRequest(tradeId: string): Promise<{ valid: boolean; trade?: any; error?: string }> {
    try {
      console.log(`🔄 Validating close request for trade ${tradeId}`);
      
      const { data: tradeData, error: fetchError } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('user_id', this.userId)
        .single();

      if (fetchError || !tradeData) {
        const errorMsg = `Trade ${tradeId} not found: ${fetchError?.message || 'No data'}`;
        await this.logger.logError('Trade validation failed - not found', new Error(errorMsg), { tradeId });
        return { valid: false, error: errorMsg };
      }

      if (tradeData.status === 'closed') {
        const message = `Trade ${tradeId} is already closed`;
        return { valid: false, error: message };
      }

      if (tradeData.status !== 'filled') {
        const errorMsg = `Cannot close trade ${tradeId}: status is ${tradeData.status}, expected 'filled'`;
        await this.logger.logError('Trade validation failed - invalid status', new Error(errorMsg), { 
          tradeId, 
          currentStatus: tradeData.status 
        });
        return { valid: false, error: errorMsg };
      }

      return { valid: true, trade: tradeData };
    } catch (error) {
      const errorMsg = `Validation error for trade ${tradeId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await this.logger.logError('Trade validation failed - exception', error, { tradeId });
      return { valid: false, error: errorMsg };
    }
  }
}
