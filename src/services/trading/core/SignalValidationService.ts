
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';
import { TradeValidator } from './TradeValidator';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  calculatedData?: {
    quantity: number;
    entryPrice: number;
    takeProfitPrice: number;
    orderValue: number;
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
      console.log(`🔍 Validating signal for ${signal.symbol}...`);

      // Validate signal structure
      if (!signal || !signal.symbol || !signal.signal_type || !signal.price) {
        return { isValid: false, reason: 'Invalid signal structure' };
      }

      // Check for existing unprocessed signals
      const { data: existingSignals, error: signalsError } = await supabase
        .from('trading_signals')
        .select('id')
        .eq('user_id', this.userId)
        .eq('symbol', signal.symbol)
        .eq('processed', false);

      if (signalsError) {
        console.error(`❌ Error checking existing signals:`, signalsError);
        return { isValid: false, reason: 'Database error checking signals' };
      }

      if (existingSignals && existingSignals.length >= config.max_positions_per_pair) {
        return { 
          isValid: false, 
          reason: `Max unprocessed signals reached (${existingSignals.length}/${config.max_positions_per_pair})` 
        };
      }

      // Check for active positions
      const { data: activeTrades, error: tradesError } = await supabase
        .from('trades')
        .select('id')
        .eq('user_id', this.userId)
        .eq('symbol', signal.symbol)
        .eq('side', 'buy')
        .in('status', ['pending', 'filled', 'partial_filled']);

      if (tradesError) {
        console.error(`❌ Error checking active trades:`, tradesError);
        return { isValid: false, reason: 'Database error checking trades' };
      }

      const activeCount = activeTrades?.length || 0;
      if (activeCount >= config.max_positions_per_pair) {
        return { 
          isValid: false, 
          reason: `Max active positions reached (${activeCount}/${config.max_positions_per_pair})` 
        };
      }

      // Calculate order parameters
      const signalPrice = parseFloat(signal.price.toString());
      if (isNaN(signalPrice) || signalPrice <= 0) {
        return { isValid: false, reason: 'Invalid signal price' };
      }

      const entryPrice = signalPrice * (1 + (config.entry_offset_percent || 0.1) / 100);
      const takeProfitPrice = entryPrice * (1 + (config.take_profit_percent || 2.0) / 100);
      const quantity = TradeValidator.calculateQuantity(
        signal.symbol, 
        config.max_order_amount_usd || 100, 
        entryPrice, 
        config
      );

      // Validate calculated parameters
      if (!TradeValidator.validateTradeParameters(signal.symbol, quantity, entryPrice, config)) {
        return { isValid: false, reason: 'Trade parameters validation failed' };
      }

      const orderValue = quantity * entryPrice;

      console.log(`✅ Signal validation passed for ${signal.symbol}:`, {
        entryPrice: entryPrice.toFixed(6),
        takeProfitPrice: takeProfitPrice.toFixed(6),
        quantity: quantity.toFixed(6),
        orderValue: orderValue.toFixed(2)
      });

      return {
        isValid: true,
        calculatedData: {
          quantity,
          entryPrice,
          takeProfitPrice,
          orderValue
        }
      };

    } catch (error) {
      console.error(`❌ Error validating signal for ${signal.symbol}:`, error);
      await this.logger.logError(`Signal validation error for ${signal.symbol}`, error);
      return { isValid: false, reason: `Validation error: ${error.message}` };
    }
  }
}
