
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingLogger } from './TradingLogger';

export interface ExistingOrderInfo {
  id: string;
  symbol: string;
  price: number;
  status: string;
  created_at: string;
  side: string;
}

export interface OrderValidationResult {
  canPlaceOrder: boolean;
  reason?: string;
  existingOrders: ExistingOrderInfo[];
  isSecondOrder: boolean;
  requiresLowerSupport: boolean;
  minimumSupportPrice?: number;
}

export class OrderDuplicationChecker {
  private userId: string;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.userId = userId;
    this.logger = new TradingLogger(userId);
  }

  async validateOrderPlacement(
    symbol: string, 
    newSupportPrice: number, 
    config: TradingConfigData
  ): Promise<OrderValidationResult> {
    try {
      console.log(`🔍 Validating order placement for ${symbol} at support $${newSupportPrice.toFixed(6)}`);

      // Get existing active orders for this symbol
      const existingOrders = await this.getActiveOrdersForSymbol(symbol);
      
      console.log(`📊 Found ${existingOrders.length} existing active orders for ${symbol}`);
      existingOrders.forEach(order => {
        console.log(`  - Order ${order.id}: ${order.side} at $${order.price} (${order.status})`);
      });

      // Case 1: No existing orders - can place first order
      if (existingOrders.length === 0) {
        console.log(`✅ No existing orders for ${symbol} - can place first order`);
        return {
          canPlaceOrder: true,
          existingOrders,
          isSecondOrder: false,
          requiresLowerSupport: false
        };
      }

      // Case 2: Already have 2 orders - cannot place more
      if (existingOrders.length >= 2) {
        console.log(`❌ Already have ${existingOrders.length} orders for ${symbol} - maximum reached`);
        return {
          canPlaceOrder: false,
          reason: `Maximum 2 active orders per instrument reached for ${symbol}`,
          existingOrders,
          isSecondOrder: false,
          requiresLowerSupport: false
        };
      }

      // Case 3: Have 1 existing order - check if second order is allowed
      const firstOrder = existingOrders[0];
      const firstOrderPrice = parseFloat(firstOrder.price.toString());

      // Check if this would be a valid second order (EOD scenario)
      const isEODSecondOrder = await this.checkEODSecondOrderEligibility(symbol, firstOrder);
      
      if (!isEODSecondOrder) {
        console.log(`❌ Cannot place second order for ${symbol} - not eligible (no EOD scenario or first order not in loss)`);
        return {
          canPlaceOrder: false,
          reason: `Cannot place duplicate order for ${symbol} - first order still active and not in EOD loss scenario`,
          existingOrders,
          isSecondOrder: false,
          requiresLowerSupport: false
        };
      }

      // FIXED: Use proper support lower bound percentage (minimum 5%)
      const supportLowerBoundPercent = Math.max(config.support_lower_bound_percent || 5.0, 5.0);
      const minimumSupportPrice = firstOrderPrice * (1 - supportLowerBoundPercent / 100);
      
      console.log(`📊 Support level validation for ${symbol}:`);
      console.log(`  - First order price: $${firstOrderPrice.toFixed(6)}`);
      console.log(`  - New support price: $${newSupportPrice.toFixed(6)}`);
      console.log(`  - Required minimum: $${minimumSupportPrice.toFixed(6)} (${supportLowerBoundPercent}% lower)`);

      if (newSupportPrice >= minimumSupportPrice) {
        console.log(`❌ New support level $${newSupportPrice.toFixed(6)} not sufficiently below first order price`);
        return {
          canPlaceOrder: false,
          reason: `New support level must be at least ${supportLowerBoundPercent}% below existing order price`,
          existingOrders,
          isSecondOrder: true,
          requiresLowerSupport: true,
          minimumSupportPrice
        };
      }

      console.log(`✅ Second order validation passed for ${symbol} - support level is sufficiently lower`);
      return {
        canPlaceOrder: true,
        existingOrders,
        isSecondOrder: true,
        requiresLowerSupport: false
      };

    } catch (error) {
      console.error(`❌ Error validating order placement for ${symbol}:`, error);
      await this.logger.logError(`Order validation failed for ${symbol}`, error);
      
      return {
        canPlaceOrder: false,
        reason: `Validation error: ${error.message}`,
        existingOrders: [],
        isSecondOrder: false,
        requiresLowerSupport: false
      };
    }
  }

  private async getActiveOrdersForSymbol(symbol: string): Promise<ExistingOrderInfo[]> {
    try {
      const { data: trades, error } = await supabase
        .from('trades')
        .select('id, symbol, price, status, created_at, side')
        .eq('user_id', this.userId)
        .eq('symbol', symbol)
        .eq('side', 'buy') // Only check buy orders for duplication
        .in('status', ['pending', 'filled', 'partial_filled'])
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return trades || [];
    } catch (error) {
      console.error(`Error fetching active orders for ${symbol}:`, error);
      throw error;
    }
  }

  private async checkEODSecondOrderEligibility(symbol: string, firstOrder: ExistingOrderInfo): Promise<boolean> {
    try {
      // Check if there's a recent EOD log entry for this symbol indicating it was in loss
      const { data: eodLogs, error } = await supabase
        .from('trading_logs')
        .select('*')
        .eq('user_id', this.userId)
        .eq('log_type', 'EOD_PROCESS')
        .ilike('message', `%${symbol}%`)
        .ilike('message', '%loss%')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn(`Warning: Could not check EOD logs for ${symbol}:`, error);
        return false;
      }

      const hasEODLossRecord = eodLogs && eodLogs.length > 0;
      
      console.log(`📊 EOD eligibility check for ${symbol}:`);
      console.log(`  - Has recent EOD loss record: ${hasEODLossRecord}`);
      console.log(`  - First order created: ${firstOrder.created_at}`);

      return hasEODLossRecord;
    } catch (error) {
      console.warn(`Warning: Error checking EOD eligibility for ${symbol}:`, error);
      return false;
    }
  }
}
