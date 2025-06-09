
import { calculateSideAwarePL, validateNumericValue } from '@/utils/formatters';
import { getCurrentPrice } from './priceUtils';

export const calculateActualPL = async (trade: any, userId: string) => {
  try {
    // Validate and normalize input values
    const entryPrice = validateNumericValue(trade.price, 'entry price');
    const quantity = validateNumericValue(trade.quantity, 'quantity');
    const fillPrice = trade.buy_fill_price ? validateNumericValue(trade.buy_fill_price, 'fill price') : null;

    if (entryPrice <= 0 || quantity <= 0) {
      console.warn(`Invalid trade data for P&L calculation:`, {
        tradeId: trade.id,
        symbol: trade.symbol,
        entryPrice,
        quantity
      });
      return 0;
    }

    // For closed trades, use the stored profit_loss if it exists and is reasonable
    if (['closed', 'cancelled'].includes(trade.status)) {
      if (trade.profit_loss !== null && trade.profit_loss !== undefined) {
        const storedPL = validateNumericValue(trade.profit_loss, 'stored P&L');
        console.log(`Using stored P&L for closed trade ${trade.symbol}: $${storedPL}`);
        return storedPL;
      }
      return 0;
    }

    // For active filled trades, calculate real-time P&L
    if (trade.status === 'filled') {
      const currentPrice = await getCurrentPrice(trade.symbol, userId);
      
      if (currentPrice && currentPrice > 0) {
        const actualPL = calculateSideAwarePL(
          trade.side, 
          entryPrice, 
          currentPrice, 
          quantity,
          fillPrice,
          trade.status
        );
        
        console.log(`Calculated P&L for ${trade.symbol}: Entry=$${entryPrice}, Fill=${fillPrice ? `$${fillPrice}` : 'N/A'}, Current=$${currentPrice}, P&L=$${actualPL}`);
        return actualPL;
      } else {
        console.warn(`Unable to get current price for ${trade.symbol}`);
      }
    }

    return 0;
  } catch (error) {
    console.error(`Error calculating P&L for trade ${trade.id}:`, error);
    return 0;
  }
};

export const calculateTradeMetrics = (trades: any[]) => {
  if (!Array.isArray(trades) || trades.length === 0) {
    return {
      totalTrades: 0,
      closedTrades: 0,
      filledTrades: 0,
      totalProfit: 0,
      closedPositionsProfit: 0,
      totalVolume: 0,
      profitPercentage: 0,
      profitableClosedCount: 0
    };
  }

  const totalTrades = trades.length;
  const closedTrades = trades.filter(t => ['closed', 'cancelled'].includes(t.status));
  const filledTrades = trades.filter(t => t.status === 'filled');
  
  let totalProfit = 0;
  let closedPositionsProfit = 0;
  let totalVolume = 0;
  let profitableClosedCount = 0;

  trades.forEach(trade => {
    try {
      const price = validateNumericValue(trade.price, 'price');
      const quantity = validateNumericValue(trade.quantity, 'quantity');
      const fillPrice = trade.buy_fill_price ? validateNumericValue(trade.buy_fill_price, 'fill price') : null;
      const actualPL = validateNumericValue(trade.actualPL, 'actual P&L');
      
      // Calculate volume using fill price if available for filled orders
      let effectivePrice = price;
      if (trade.status === 'filled' && fillPrice && fillPrice > 0) {
        effectivePrice = fillPrice;
      }
      
      const volume = effectivePrice * quantity;
      if (volume > 0) {
        totalVolume += volume;
      }
      
      // Add to total profit
      totalProfit += actualPL;
      
      // Add to closed positions profit only if trade is closed
      if (['closed', 'cancelled'].includes(trade.status)) {
        closedPositionsProfit += actualPL;
        
        // Count closed and cancelled trades with positive actual P&L as profitable
        if (actualPL > 0) {
          profitableClosedCount++;
        }
      }
    } catch (error) {
      console.error(`Error processing trade metrics for trade ${trade.id}:`, error);
    }
  });

  // Calculate profit percentage based on closed trades only
  const profitPercentage = closedTrades.length > 0 ? (profitableClosedCount / closedTrades.length) * 100 : 0;

  return {
    totalTrades,
    closedTrades: closedTrades.length,
    filledTrades: filledTrades.length,
    totalProfit: Math.round(totalProfit * 100) / 100,
    closedPositionsProfit: Math.round(closedPositionsProfit * 100) / 100,
    totalVolume: Math.round(totalVolume * 100) / 100,
    profitPercentage: Math.round(profitPercentage * 100) / 100,
    profitableClosedCount
  };
};

/**
 * Validate trade data for P&L calculations
 * @param trade - Trade object to validate
 * @returns Validation result with normalized data
 */
export const validateTradeData = (trade: any): {
  isValid: boolean;
  normalizedTrade?: any;
  errors?: string[];
} => {
  const errors: string[] = [];

  if (!trade) {
    errors.push('Trade object is null or undefined');
    return { isValid: false, errors };
  }

  if (!trade.id) {
    errors.push('Trade ID is missing');
  }

  if (!trade.symbol || typeof trade.symbol !== 'string') {
    errors.push('Invalid or missing symbol');
  }

  if (!trade.side || !['buy', 'sell'].includes(trade.side.toLowerCase())) {
    errors.push('Invalid or missing side');
  }

  const price = validateNumericValue(trade.price, 'price');
  if (price <= 0) {
    errors.push('Invalid price');
  }

  const quantity = validateNumericValue(trade.quantity, 'quantity');
  if (quantity <= 0) {
    errors.push('Invalid quantity');
  }

  if (!trade.status || typeof trade.status !== 'string') {
    errors.push('Invalid or missing status');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Return normalized trade data
  const normalizedTrade = {
    ...trade,
    price: price,
    quantity: quantity,
    buy_fill_price: trade.buy_fill_price ? validateNumericValue(trade.buy_fill_price, 'fill price') : null,
    profit_loss: trade.profit_loss ? validateNumericValue(trade.profit_loss, 'profit loss') : null,
    side: trade.side.toLowerCase()
  };

  return { isValid: true, normalizedTrade };
};
