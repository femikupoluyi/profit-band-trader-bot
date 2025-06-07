
export const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

export const formatPercentage = (entry: number, current: number): string => {
  if (entry === 0) return '0.00%';
  const percentage = ((current - entry) / entry) * 100;
  return `${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%`;
};

/**
 * Calculate side-aware P&L for trading positions using actual fill prices
 * Only calculates P&L for filled orders with valid fill prices
 * @param side - 'buy' or 'sell'
 * @param entryPrice - Original entry price (fallback if no fill price)
 * @param currentPrice - Current market price
 * @param quantity - Position quantity
 * @param fillPrice - Actual fill price from exchange (optional)
 * @param status - Trade status
 * @returns P&L value (positive for profit, negative for loss, 0 for non-filled)
 */
export const calculateSideAwarePL = (
  side: string, 
  entryPrice: number, 
  currentPrice: number, 
  quantity: number,
  fillPrice?: number,
  status?: string
): number => {
  // Only calculate P&L for filled orders
  if (status !== 'filled') {
    return 0;
  }

  // Use actual fill price if available, otherwise fallback to entry price
  const actualEntryPrice = fillPrice || entryPrice;
  
  if (side === 'buy') {
    return (currentPrice - actualEntryPrice) * quantity;
  } else {
    return (actualEntryPrice - currentPrice) * quantity;
  }
};

/**
 * Calculate side-aware percentage change for trading positions using actual fill prices
 * Only calculates percentage for filled orders with valid fill prices
 * @param side - 'buy' or 'sell'
 * @param entryPrice - Original entry price (fallback if no fill price)
 * @param currentPrice - Current market price
 * @param fillPrice - Actual fill price from exchange (optional)
 * @param status - Trade status
 * @returns Percentage change (positive for profit, negative for loss, 0 for non-filled)
 */
export const calculateSideAwarePercentage = (
  side: string, 
  entryPrice: number, 
  currentPrice: number,
  fillPrice?: number,
  status?: string
): number => {
  // Only calculate percentage for filled orders
  if (status !== 'filled') {
    return 0;
  }

  // Use actual fill price if available, otherwise fallback to entry price
  const actualEntryPrice = fillPrice || entryPrice;
  
  if (actualEntryPrice === 0) return 0;
  
  if (side === 'buy') {
    return ((currentPrice - actualEntryPrice) / actualEntryPrice) * 100;
  } else {
    return ((actualEntryPrice - currentPrice) / actualEntryPrice) * 100;
  }
};
