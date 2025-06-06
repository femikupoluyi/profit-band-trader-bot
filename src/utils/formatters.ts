export const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

export const formatPercentage = (entry: number, current: number): string => {
  if (entry === 0) return '0.00%';
  const percentage = ((current - entry) / entry) * 100;
  return `${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%`;
};

/**
 * Calculate SPOT trading P&L - Only for filled buy positions with linked TP sells
 * @param entryPrice - Buy fill price (actual fill price from Bybit)
 * @param currentPrice - Current market price
 * @param quantity - Position quantity
 * @returns P&L value (positive for profit, negative for loss)
 */
export const calculateSpotPL = (entryPrice: number, currentPrice: number, quantity: number): number => {
  // Validate inputs
  if (!entryPrice || !currentPrice || !quantity || entryPrice <= 0 || quantity <= 0) {
    return 0;
  }
  
  // For spot trading, P&L is simply (current - entry) * quantity
  return (currentPrice - entryPrice) * quantity;
};

/**
 * Calculate SPOT trading percentage change - Only for filled buy positions with linked TP sells
 * @param entryPrice - Buy fill price (actual fill price from Bybit)
 * @param currentPrice - Current market price
 * @returns Percentage change (positive for profit, negative for loss)
 */
export const calculateSpotPercentage = (entryPrice: number, currentPrice: number): number => {
  // Validate inputs
  if (!entryPrice || !currentPrice || entryPrice <= 0) {
    return 0;
  }
  
  // Calculate percentage change
  return ((currentPrice - entryPrice) / entryPrice) * 100;
};

/**
 * Check if a position should show P&L (filled buy with linked pending TP sell)
 * @param trade - The trade object to check
 * @returns True if P&L should be displayed
 */
export const shouldShowSpotPL = (trade: any): boolean => {
  // Show P&L for closed trades (always have realized P&L)
  if (trade.status === 'closed') {
    return true;
  }
  
  // Show P&L for filled buy orders that have a linked take-profit sell order
  if (trade.side === 'buy' && 
      trade.status === 'filled' && 
      trade.sell_order_id) {
    return true;
  }
  
  return false;
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

// Helper function to get proper entry price with schema-aware fallback
export const getTradeEntryPrice = (trade: any): number => {
  // For buy orders, prefer buy_fill_price, fallback to price
  if (trade.side === 'buy') {
    return trade.buy_fill_price || trade.price || 0;
  }
  
  // For sell orders, use the original price
  return trade.price || 0;
};

// Helper function to determine trade volume for P&L calculations
export const getTradeVolume = (trade: any): number => {
  const entryPrice = getTradeEntryPrice(trade);
  return entryPrice * (trade.quantity || 0);
};
