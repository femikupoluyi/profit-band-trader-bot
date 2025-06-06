
export const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

export const formatPercentage = (entry: number, current: number): string => {
  if (entry === 0) return '0.00%';
  const percentage = ((current - entry) / entry) * 100;
  return `${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%`;
};

/**
 * Calculate side-aware P&L for trading positions
 * @param side - 'buy' or 'sell'
 * @param entryPrice - Entry price of the position
 * @param currentPrice - Current market price
 * @param quantity - Position quantity
 * @returns P&L value (positive for profit, negative for loss)
 */
export const calculateSideAwarePL = (side: string, entryPrice: number, currentPrice: number, quantity: number): number => {
  if (side === 'buy') {
    return (currentPrice - entryPrice) * quantity;
  } else {
    return (entryPrice - currentPrice) * quantity;
  }
};

/**
 * Calculate side-aware percentage change for trading positions
 * @param side - 'buy' or 'sell'
 * @param entryPrice - Entry price of the position
 * @param currentPrice - Current market price
 * @returns Percentage change (positive for profit, negative for loss)
 */
export const calculateSideAwarePercentage = (side: string, entryPrice: number, currentPrice: number): number => {
  if (entryPrice === 0) return 0;
  
  if (side === 'buy') {
    return ((currentPrice - entryPrice) / entryPrice) * 100;
  } else {
    return ((entryPrice - currentPrice) / entryPrice) * 100;
  }
};
