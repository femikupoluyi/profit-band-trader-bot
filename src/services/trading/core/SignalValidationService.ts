
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';
import { supabase } from '@/integrations/supabase/client';

interface ValidationResult {
  isValid: boolean;
  reason?: string;
  calculatedData?: {
    quantity: number;
    entryPrice: number;
    takeProfitPrice: number;
  };
}

export class SignalValidationService {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  async validateSignal(signal: any, config: TradingConfigData): Promise<ValidationResult> {
    try {
      console.log(`🔍 Validating signal for ${signal.symbol}`);

      // Validate signal has required fields
      if (!signal.symbol || !signal.signal_type || !signal.price) {
        return { 
          isValid: false, 
          reason: 'Signal missing required fields (symbol, signal_type, or price)' 
        };
      }

      // Validate signal type
      if (signal.signal_type !== 'BUY') {
        return { 
          isValid: false, 
          reason: `Invalid signal type: ${signal.signal_type}. Only BUY signals are supported.` 
        };
      }

      // Validate symbol is in trading pairs
      if (!config.trading_pairs?.includes(signal.symbol)) {
        return { 
          isValid: false, 
          reason: `Symbol ${signal.symbol} not in configured trading pairs` 
        };
      }

      // Check if we already have active positions for this symbol
      const hasActivePosition = await this.checkActivePositions(signal.symbol, config.max_positions_per_pair || 1);
      if (hasActivePosition) {
        return { 
          isValid: false, 
          reason: `Already have maximum positions for ${signal.symbol}` 
        };
      }

      // Calculate order parameters
      const calculatedData = await this.calculateOrderParameters(signal, config);
      if (!calculatedData) {
        return { 
          isValid: false, 
          reason: 'Failed to calculate order parameters' 
        };
      }

      // Validate order size
      const orderValue = calculatedData.quantity * calculatedData.entryPrice;
      if (orderValue > (config.maximum_order_amount_usd || 100)) {
        return { 
          isValid: false, 
          reason: `Order value $${orderValue.toFixed(2)} exceeds maximum allowed $${config.maximum_order_amount_usd || 100}` 
        };
      }

      console.log(`✅ Signal validation passed for ${signal.symbol}`);
      return { 
        isValid: true, 
        calculatedData 
      };

    } catch (error) {
      console.error(`❌ Error validating signal for ${signal.symbol}:`, error);
      await this.logger.logError(`Signal validation error for ${signal.symbol}`, error);
      return { 
        isValid: false, 
        reason: `Validation error: ${error.message}` 
      };
    }
  }

  private async checkActivePositions(symbol: string, maxPositions: number): Promise<boolean> {
    try {
      const { data: activeTrades, error } = await supabase
        .from('trades')
        .select('id')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('side', 'buy')
        .in('status', ['pending', 'filled', 'partial_filled']);

      if (error) {
        console.error(`❌ Error checking active positions for ${symbol}:`, error);
        return true; // Err on the side of caution
      }

      const activeCount = activeTrades?.length || 0;
      console.log(`📊 Active positions for ${symbol}: ${activeCount}/${maxPositions}`);
      
      return activeCount >= maxPositions;
    } catch (error) {
      console.error(`❌ Database error checking active positions for ${symbol}:`, error);
      return true; // Err on the side of caution
    }
  }

  private async calculateOrderParameters(signal: any, config: TradingConfigData): Promise<{
    quantity: number;
    entryPrice: number;
    takeProfitPrice: number;
  } | null> {
    try {
      // Get current market price
      const currentPrice = parseFloat(signal.price);
      if (!currentPrice || currentPrice <= 0) {
        throw new Error('Invalid signal price');
      }

      // Calculate entry price with offset
      const entryOffsetPercent = config.entry_offset_percent || 0.1;
      const entryPrice = currentPrice * (1 - entryOffsetPercent / 100);

      // Calculate take profit price
      const takeProfitPercent = config.take_profit_percent || 2.0;
      const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);

      // Calculate quantity based on max order amount
      const maxOrderAmount = config.maximum_order_amount_usd || 100;
      const quantity = maxOrderAmount / entryPrice;

      console.log(`📊 Calculated order parameters for ${signal.symbol}:`);
      console.log(`  Current Price: $${currentPrice.toFixed(6)}`);
      console.log(`  Entry Price: $${entryPrice.toFixed(6)} (${entryOffsetPercent}% below current)`);
      console.log(`  Take Profit: $${takeProfitPrice.toFixed(6)} (${takeProfitPercent}% above entry)`);
      console.log(`  Quantity: ${quantity.toFixed(6)}`);
      console.log(`  Order Value: $${(quantity * entryPrice).toFixed(2)}`);

      return {
        quantity,
        entryPrice,
        takeProfitPrice
      };

    } catch (error) {
      console.error(`❌ Error calculating order parameters for ${signal.symbol}:`, error);
      return null;
    }
  }
}
