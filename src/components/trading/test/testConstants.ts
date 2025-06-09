
import { TRADING_ENVIRONMENT } from '@/services/trading/core/TypeDefinitions';

// Test symbols - these are acceptable as hard-coded values for testing purposes
export const TEST_SYMBOLS = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT'
} as const;

export const TEST_CONFIG = {
  TEST_ORDER_AMOUNT: 100, // Amount for demo account testing
  ORDER_STATUS_CHECK_DELAY: 2000,
  ACCOUNT_TYPE: 'UNIFIED',
  ORDER_TIME_IN_FORCE: 'IOC',
  ENVIRONMENT: TRADING_ENVIRONMENT
} as const;

export const TEST_NAMES = {
  API_CREDENTIALS: 'API Credentials',
  BYBIT_API: 'Bybit DEMO Trading API',
  TRADING_CONFIG: 'Trading Configuration',
  SIGNAL_GENERATION: 'Signal Generation',
  ACCOUNT_BALANCE: 'Account Balance Check',
  MARKET_ORDER: 'Market Order Tests (DEMO)', 
  ORDER_STATUS: 'Order Status Check'
} as const;

export const TEST_MESSAGES = {
  SUCCESS: {
    API_CONNECTION: '✅ Bybit DEMO trading API working!',
    CONFIG_VALID: '✅ Trading configuration is valid',
    CREDENTIALS_FOUND: '✅ API credentials found and active'
  },
  ERROR: {
    API_FAILED: '❌ API connection failed',
    CONFIG_INVALID: '❌ Trading configuration has errors',
    CREDENTIALS_MISSING: '❌ No active API credentials found'
  }
} as const;

/**
 * Get available test symbols dynamically
 * This function can be extended to fetch symbols from configuration or API
 */
export const getTestSymbols = (): string[] => {
  return Object.values(TEST_SYMBOLS);
};

/**
 * Validate if a symbol is suitable for testing
 * @param symbol - Symbol to validate
 * @returns Whether the symbol is valid for testing
 */
export const isValidTestSymbol = (symbol: string): boolean => {
  if (!symbol || typeof symbol !== 'string') {
    return false;
  }
  
  // Check if it's a USDT pair (common for testing)
  return symbol.endsWith('USDT') && symbol.length > 4;
};
