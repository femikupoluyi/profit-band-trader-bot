
export const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

export const formatPercentage = (entry: number, current: number): string => {
  if (entry === 0) return '0.00%';
  const percentage = ((current - entry) / entry) * 100;
  return `${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%`;
};

/**
 * Enhanced side-aware P&L calculation with improved validation and error handling
 * @param side - 'buy' or 'sell'
 * @param entryPrice - Original entry price (fallback if no fill price)
 * @param currentPrice - Current market price
 * @param quantity - Position quantity (must be positive)
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
  // Validate inputs
  if (!side || typeof side !== 'string') {
    console.warn('Invalid side parameter for P&L calculation');
    return 0;
  }

  if (entryPrice <= 0 || currentPrice <= 0 || quantity <= 0) {
    console.warn('Invalid price or quantity parameters for P&L calculation:', {
      entryPrice, currentPrice, quantity
    });
    return 0;
  }

  // Only calculate P&L for filled orders
  if (!status || status !== 'filled') {
    return 0;
  }

  // Use actual fill price if available and valid, otherwise fallback to entry price
  let actualEntryPrice = entryPrice;
  if (fillPrice && fillPrice > 0) {
    actualEntryPrice = fillPrice;
  }

  // Calculate P&L based on side
  const normalizedSide = side.toLowerCase();
  let pl = 0;

  if (normalizedSide === 'buy') {
    pl = (currentPrice - actualEntryPrice) * quantity;
  } else if (normalizedSide === 'sell') {
    pl = (actualEntryPrice - currentPrice) * quantity;
  } else {
    console.warn(`Unknown side '${side}' for P&L calculation`);
    return 0;
  }

  // Round to 2 decimal places to avoid floating point precision issues
  return Math.round(pl * 100) / 100;
};

/**
 * Enhanced side-aware percentage calculation with improved validation
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
  // Validate inputs
  if (!side || typeof side !== 'string') {
    console.warn('Invalid side parameter for percentage calculation');
    return 0;
  }

  if (entryPrice <= 0 || currentPrice <= 0) {
    console.warn('Invalid price parameters for percentage calculation:', {
      entryPrice, currentPrice
    });
    return 0;
  }

  // Only calculate percentage for filled orders
  if (!status || status !== 'filled') {
    return 0;
  }

  // Use actual fill price if available and valid, otherwise fallback to entry price
  let actualEntryPrice = entryPrice;
  if (fillPrice && fillPrice > 0) {
    actualEntryPrice = fillPrice;
  }

  // Calculate percentage based on side
  const normalizedSide = side.toLowerCase();
  let percentage = 0;

  if (normalizedSide === 'buy') {
    percentage = ((currentPrice - actualEntryPrice) / actualEntryPrice) * 100;
  } else if (normalizedSide === 'sell') {
    percentage = ((actualEntryPrice - currentPrice) / actualEntryPrice) * 100;
  } else {
    console.warn(`Unknown side '${side}' for percentage calculation`);
    return 0;
  }

  // Round to 2 decimal places
  return Math.round(percentage * 100) / 100;
};

/**
 * Validate numeric values for trading calculations
 * @param value - Value to validate
 * @param fieldName - Name of the field for error messages
 * @returns Valid number or 0 if invalid
 */
export const validateNumericValue = (value: any, fieldName: string): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
  
  if (isNaN(numValue) || !isFinite(numValue)) {
    console.warn(`Invalid ${fieldName}: ${value}, using 0`);
    return 0;
  }

  return numValue;
};
