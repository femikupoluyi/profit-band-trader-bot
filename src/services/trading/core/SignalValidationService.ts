
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
      console.log(`\n🔍 ===== SIGNAL VALIDATION FOR ${signal.symbol} =====`);
      console.log(`📋 Signal Details:`, {
        id: signal.id,
        symbol: signal.symbol,
        signalType: signal.signal_type,
        price: signal.price,
        confidence: signal.confidence,
        createdAt: signal.created_at
      });

      // Step 1: Validate signal has required fields
      console.log(`📋 Step 1: Checking required fields...`);
      if (!signal.symbol || !signal.signal_type || !signal.price) {
        const reason = 'Signal missing required fields (symbol, signal_type, or price)';
        console.log(`❌ ${signal.symbol}: ${reason}`);
        return { isValid: false, reason };
      }
      console.log(`✅ ${signal.symbol}: All required fields present`);

      // Step 2: Validate signal type
      console.log(`📋 Step 2: Validating signal type...`);
      if (signal.signal_type !== 'buy') {
        const reason = `Invalid signal type: ${signal.signal_type}. Only 'buy' signals are supported.`;
        console.log(`❌ ${signal.symbol}: ${reason}`);
        return { isValid: false, reason };
      }
      console.log(`✅ ${signal.symbol}: Signal type 'buy' is valid`);

      // Step 3: Validate symbol is in trading pairs
      console.log(`📋 Step 3: Checking if symbol is in trading pairs...`);
      console.log(`📊 Configured trading pairs:`, config.trading_pairs);
      if (!config.trading_pairs?.includes(signal.symbol)) {
        const reason = `Symbol ${signal.symbol} not in configured trading pairs`;
        console.log(`❌ ${signal.symbol}: ${reason}`);
        return { isValid: false, reason };
      }
      console.log(`✅ ${signal.symbol}: Symbol is in configured trading pairs`);

      // Step 4: Check if we already have active positions for this symbol
      console.log(`📋 Step 4: Checking active positions...`);
      const hasActivePosition = await this.checkActivePositions(signal.symbol, config.max_positions_per_pair || 1);
      if (hasActivePosition) {
        const reason = `Already have maximum positions for ${signal.symbol}`;
        console.log(`❌ ${signal.symbol}: ${reason}`);
        return { isValid: false, reason };
      }
      console.log(`✅ ${signal.symbol}: No conflicting active positions`);

      // Step 5: Calculate order parameters
      console.log(`📋 Step 5: Calculating order parameters...`);
      const calculatedData = await this.calculateOrderParameters(signal, config);
      if (!calculatedData) {
        const reason = 'Failed to calculate order parameters';
        console.log(`❌ ${signal.symbol}: ${reason}`);
        return { isValid: false, reason };
      }
      console.log(`✅ ${signal.symbol}: Order parameters calculated successfully`);

      // Step 6: Validate order size
      console.log(`📋 Step 6: Validating order size...`);
      const orderValue = calculatedData.quantity * calculatedData.entryPrice;
      const maxOrderAmount = config.max_order_amount_usd || 100;
      
      console.log(`📊 ${signal.symbol}: Order value validation:
        - Calculated Order Value: $${orderValue.toFixed(2)}
        - Maximum Allowed: $${maxOrderAmount}
        - Within Limits: ${orderValue <= maxOrderAmount ? 'YES' : 'NO'}`);
        
      if (orderValue > maxOrderAmount) {
        const reason = `Order value $${orderValue.toFixed(2)} exceeds maximum allowed $${maxOrderAmount}`;
        console.log(`❌ ${signal.symbol}: ${reason}`);
        return { isValid: false, reason };
      }
      console.log(`✅ ${signal.symbol}: Order size within limits`);

      console.log(`🎉 ${signal.symbol}: Signal validation PASSED - ready for execution!`);
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
      console.log(`📊 Checking active positions for ${symbol} (max allowed: ${maxPositions})...`);
      
      const { data: activeTrades, error } = await supabase
        .from('trades')
        .select('id, status, side, price, quantity, created_at')
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
      
      if (activeTrades && activeTrades.length > 0) {
        console.log(`📋 Active trades details:`, activeTrades.map(trade => ({
          id: trade.id,
          status: trade.status,
          price: trade.price,
          quantity: trade.quantity,
          created: trade.created_at
        })));
      }
      
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
      console.log(`🧮 Calculating order parameters for ${signal.symbol}...`);
      
      // Get current market price
      const currentPrice = parseFloat(signal.price);
      if (!currentPrice || currentPrice <= 0) {
        console.log(`❌ ${signal.symbol}: Invalid signal price: ${signal.price}`);
        throw new Error('Invalid signal price');
      }

      // Calculate entry price with offset
      const entryOffsetPercent = config.entry_offset_percent || 0.1;
      const entryPrice = currentPrice * (1 - entryOffsetPercent / 100);

      // Calculate take profit price
      const takeProfitPercent = config.take_profit_percent || 2.0;
      const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);

      // Calculate quantity based on max order amount
      const maxOrderAmount = config.max_order_amount_usd || 100;
      const quantity = maxOrderAmount / entryPrice;

      console.log(`🧮 ${signal.symbol}: Calculated order parameters:
        - Current Price: $${currentPrice.toFixed(6)}
        - Entry Offset: ${entryOffsetPercent}%
        - Entry Price: $${entryPrice.toFixed(6)} (${entryOffsetPercent}% below current)
        - Take Profit %: ${takeProfitPercent}%
        - Take Profit Price: $${takeProfitPrice.toFixed(6)} (${takeProfitPercent}% above entry)
        - Max Order Amount: $${maxOrderAmount}
        - Calculated Quantity: ${quantity.toFixed(6)}
        - Total Order Value: $${(quantity * entryPrice).toFixed(2)}`);

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
