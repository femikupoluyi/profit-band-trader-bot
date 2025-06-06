
export const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

export const formatPercentage = (entry: number, current: number): string => {
  if (entry === 0) return '0.00%';
  const percentage = ((current - entry) / entry) * 100;
  return `${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%`;
};

/**
 * Calculate SPOT trading P&L - Only for filled buy positions
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
 * Calculate SPOT trading percentage change - Only for filled buy positions
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
 * Check if a position should show P&L (filled buy with pending take-profit sell)
 * @param trade - The trade object to check
 * @param sellTrade - Optional corresponding sell trade object
 * @returns True if P&L should be displayed
 */
export const shouldShowSpotPL = (trade: any, sellTrade?: any): boolean => {
  // Only show P&L if:
  // 1. Trade is a filled buy
  // 2. No corresponding sell trade exists, OR sell trade is still pending
  return trade.side === 'buy' && 
         trade.status === 'filled' && 
         (!sellTrade || sellTrade.status === 'pending');
};

// Legacy functions - kept for backward compatibility but marked as deprecated
/**
 * @deprecated Use calculateSpotPL for spot trading
 */
export const calculateSideAwarePL = (side: string, entryPrice: number, currentPrice: number, quantity: number): number => {
  // For spot trading, we only calculate P&L for buy positions
  if (side === 'buy') {
    return (currentPrice - entryPrice) * quantity;
  }
  return 0; // No P&L shown for sell positions in spot trading
};

/**
 * @deprecated Use calculateSpotPercentage for spot trading  
 */
export const calculateSideAwarePercentage = (side: string, entryPrice: number, currentPrice: number): number => {
  if (entryPrice === 0) return 0;
  
  // For spot trading, we only calculate percentage for buy positions
  if (side === 'buy') {
    return ((currentPrice - entryPrice) / entryPrice) * 100;
  }
  return 0; // No percentage shown for sell positions in spot trading
};
