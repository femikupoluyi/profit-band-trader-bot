
export const TEST_SYMBOLS = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT'
} as const;

export const TEST_CONFIG = {
  TEST_ORDER_AMOUNT: 100, // Amount for demo account testing
  ORDER_STATUS_CHECK_DELAY: 2000,
  ACCOUNT_TYPE: 'UNIFIED',
  ORDER_TIME_IN_FORCE: 'IOC'
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
