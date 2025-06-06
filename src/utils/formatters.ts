
export const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

export const formatPercentage = (entry: number, current: number): string => {
  if (entry === 0) return '0.00%';
  const percentage = ((current - entry) / entry) * 100;
  return `${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%`;
};

/**
 * Calculate SPOT trading P&L - Only for buy positions with filled entry
 * @param entryPrice - Entry price of the filled buy position
 * @param currentPrice - Current market price
 * @param quantity - Position quantity
 * @returns P&L value (positive for profit, negative for loss)
 */
export const calculateSpotPL = (entryPrice: number, currentPrice: number, quantity: number): number => {
  // For spot trading: P&L = (currentPrice - entryPrice) * quantity
  return (currentPrice - entryPrice) * quantity;
};

/**
 * Calculate SPOT trading percentage change - Only for buy positions with filled entry
 * @param entryPrice - Entry price of the filled buy position
 * @param currentPrice - Current market price
 * @returns Percentage change (positive for profit, negative for loss)
 */
export const calculateSpotPercentage = (entryPrice: number, currentPrice: number): number => {
  if (entryPrice === 0) return 0;
  
  // For spot trading: % Change = (currentPrice - entryPrice) / entryPrice * 100
  return ((currentPrice - entryPrice) / entryPrice) * 100;
};

/**
 * Check if a position should show P&L (buy filled + sell pending)
 * @param buyTrade - The buy trade object
 * @param sellTrade - The corresponding sell trade object (if exists)
 * @returns True if P&L should be displayed
 */
export const shouldShowSpotPL = (buyTrade: any, sellTrade?: any): boolean => {
  // Only show P&L if:
  // 1. Buy trade is filled
  // 2. Sell trade is pending (take-profit order is open)
  return buyTrade.status === 'filled' && 
         buyTrade.side === 'buy' && 
         (!sellTrade || sellTrade.status === 'pending');
};

// Legacy functions for backward compatibility - marked as deprecated
/**
 * @deprecated Use calculateSpotPL for spot trading
 */
export const calculateSideAwarePL = (side: string, entryPrice: number, currentPrice: number, quantity: number): number => {
  if (side === 'buy') {
    return (currentPrice - entryPrice) * quantity;
  } else {
    return (entryPrice - currentPrice) * quantity;
  }
};

/**
 * @deprecated Use calculateSpotPercentage for spot trading
 */
export const calculateSideAwarePercentage = (side: string, entryPrice: number, currentPrice: number): number => {
  if (entryPrice === 0) return 0;
  
  if (side === 'buy') {
    return ((currentPrice - entryPrice) / entryPrice) * 100;
  } else {
    return ((entryPrice - currentPrice) / entryPrice) * 100;
  }
};
