# Enhanced Bybit Trading Bot - Complete Implementation Prompt

Create a comprehensive Bybit cryptocurrency trading bot with the following detailed specifications:

## 🔐 CRITICAL SECURITY REQUIREMENTS

### API Credential Management
- API credentials (Bybit API key and secret) must NEVER be exposed to the frontend
- Credentials stored ONLY in Supabase database (`api_credentials` table with RLS)
- Edge functions fetch credentials server-side using `auth.uid()` from JWT
- Frontend calls edge functions WITHOUT sending credentials
- Database stores `api_url` (DEMO vs LIVE) and credentials are fetched per request
- Credentials are encrypted at rest in the database

### Row-Level Security (RLS)
All tables MUST have RLS enabled with policies:
```sql
-- Example for api_credentials table
CREATE POLICY "Users can manage own API credentials"
ON api_credentials FOR ALL
USING (auth.uid() = user_id);
```

## 🎯 Core Features

### 1. Automated Trading Engine
- Scheduled via `pg_cron` (configurable interval, default 30s)
- Position monitoring and market scanning
- Signal generation, analysis, and execution
- End-of-day management
- State management with health monitoring

### 2. Trading Logic Systems

#### Logic 1: Base Support Detection
- Simple candlestick analysis
- Configurable parameters:
  - `support_candle_count` (default: 10)
  - `support_lower_bound_percent` (default: 0.5%)
  - `support_upper_bound_percent` (default: 2.0%)
  - `new_support_threshold_percent` (default: 1.0%)

#### Logic 2: Data-Driven Support Analysis
- ATR (Average True Range) analysis with `atr_multiplier` (default: 1.0)
- Fibonacci retracement with `fibonacci_sensitivity` (default: 0.618)
- Swing analysis with `swing_analysis_bars` (default: 20)
- Volume analysis with `volume_lookback_periods` (default: 50)
- Configurable `chart_timeframe` (1m, 5m, 15m, 1h, 4h, 1d)

### 3. Position Management
- `max_active_pairs` (default: 5) - Maximum trading pairs simultaneously
- `max_positions_per_pair` (default: 1) - Positions per symbol
- `max_portfolio_exposure_percent` (default: 20%) - Total portfolio exposure
- `max_order_amount_usd` (default: $100) - Per-order limit
- `max_drawdown_percent` (default: 10%) - Maximum acceptable drawdown

### 4. End-of-Day (EOD) Management
- `auto_close_at_end_of_day` (default: true)
- `daily_reset_time` (default: "00:00:00" UTC)
- `eod_close_premium_percent` (default: 0.5%) - Close profitable trades only
- Leaves losing positions open for next day

### 5. Trade Execution
- `entry_offset_percent` (default: 0.1%) - Buy below support
- `take_profit_percent` (default: 2.0%) - Sell target
- `manual_close_premium_percent` (default: 0.3%) - Manual close pricing
- Real-time order fill checking with status polling
- Automatic take-profit order placement after buy fills

## 🎨 UI Pages & Components

### Dashboard (/)
- Active trades table with real-time P&L
- Trading stats cards (Win Rate, Total P&L, Active Positions, Success Rate)
- Start/Stop engine controls with state indicators
- Quick actions (Manual close, Emergency stop)

### Trading Configuration (/config)
Tab-based configuration form:
- **Trading Pairs**: Multi-select with supported symbols
- **Trading Logic**: Radio selection (Logic 1 vs Logic 2)
- **Basic Parameters**: Entry offset, take profit, position limits
- **Position Management**: Max pairs, exposure limits, drawdown
- **Support Analysis Config**: Candle count, thresholds, sensitivity
- **EOD Management**: Auto-close settings, daily reset time
- **System Configuration**: Loop interval, chart timeframe
- **Notes**: Free-text configuration notes

### API Credentials (/api-setup)
- Secure credential input form
- Exchange selector (Bybit)
- Environment toggle (DEMO/LIVE) with visual indicators
- API URL auto-population based on environment
- Test connection button with validation
- Credential status display

### Trading Reports (/reports)
- Date range selector with presets
- Symbol filter dropdown
- Trade status filter (All, Profitable, Loss, Active)
- Trade history table with sorting
- Summary statistics cards
- CSV export functionality with filtered data

### Trading Logs (/logs)
- Real-time log viewer with auto-refresh
- Log type filter (Info, Warning, Error, Trade)
- Search functionality
- Timestamp display
- Clear logs button
- Auto-scroll to latest

### System Validation (/test)
Comprehensive test suite:
- **API Connection Test**: Verify Bybit connectivity
- **Credentials Test**: Validate API keys
- **Configuration Test**: Check trading config validity
- **Account Balance Test**: Fetch and display balance
- **Market Order Test**: Test order placement (dry run)
- **Signal Generation Test**: Verify signal logic
- **Order Status Test**: Test order tracking
- Test runner with progress indicators
- Detailed test results with pass/fail status

## 💾 Database Schema

### trading_configs
```sql
CREATE TABLE trading_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Trading Pairs
  trading_pairs TEXT[] DEFAULT ARRAY['BTCUSDT', 'ETHUSDT'],
  trading_logic_type TEXT DEFAULT 'logic1_base',
  
  -- Basic Parameters
  entry_offset_percent NUMERIC DEFAULT 0.1,
  take_profit_percent NUMERIC DEFAULT 2.0,
  
  -- Position Management
  max_active_pairs INTEGER DEFAULT 5,
  max_positions_per_pair INTEGER DEFAULT 1,
  max_order_amount_usd NUMERIC DEFAULT 100,
  max_portfolio_exposure_percent NUMERIC DEFAULT 20,
  max_drawdown_percent NUMERIC DEFAULT 10,
  
  -- Support Analysis (Logic 1)
  support_candle_count INTEGER DEFAULT 10,
  support_lower_bound_percent NUMERIC DEFAULT 0.5,
  support_upper_bound_percent NUMERIC DEFAULT 2.0,
  new_support_threshold_percent NUMERIC DEFAULT 1.0,
  
  -- Advanced Analysis (Logic 2)
  swing_analysis_bars INTEGER DEFAULT 20,
  volume_lookback_periods INTEGER DEFAULT 50,
  fibonacci_sensitivity NUMERIC DEFAULT 0.618,
  atr_multiplier NUMERIC DEFAULT 1.0,
  chart_timeframe TEXT DEFAULT '1h',
  
  -- EOD Management
  auto_close_at_end_of_day BOOLEAN DEFAULT true,
  daily_reset_time TIME DEFAULT '00:00:00',
  eod_close_premium_percent NUMERIC DEFAULT 0.5,
  manual_close_premium_percent NUMERIC DEFAULT 0.3,
  
  -- System Configuration
  main_loop_interval_seconds INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT false,
  
  -- Precision Configuration (Dynamic, fetched from Bybit)
  minimum_notional_per_symbol JSONB DEFAULT '{}'::jsonb,
  quantity_increment_per_symbol JSONB DEFAULT '{}'::jsonb,
  price_decimals_per_symbol JSONB DEFAULT '{}'::jsonb,
  quantity_decimals_per_symbol JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE trading_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own trading config"
ON trading_configs FOR ALL
USING (auth.uid() = user_id);
```

### api_credentials
```sql
CREATE TABLE api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  exchange_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  api_url TEXT DEFAULT 'https://api-demo.bybit.com',
  testnet BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own API credentials"
ON api_credentials FOR ALL
USING (auth.uid() = user_id);
```

### trading_signals
```sql
CREATE TABLE trading_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  symbol TEXT NOT NULL,
  signal_type TEXT NOT NULL, -- 'buy', 'sell'
  price NUMERIC NOT NULL,
  confidence NUMERIC, -- 0-100 score
  reasoning TEXT, -- Why this signal was generated
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_signals_user_processed ON trading_signals(user_id, processed);
CREATE INDEX idx_signals_symbol_processed ON trading_signals(symbol, processed);
```

### trades
```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL, -- 'Buy', 'Sell'
  order_type TEXT DEFAULT 'market',
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  buy_fill_price NUMERIC, -- Actual fill price for buy
  profit_loss NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'filled', 'cancelled', 'rejected', 'closed'
  bybit_order_id TEXT, -- Bybit's orderId
  bybit_trade_id TEXT, -- Bybit's execId
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trades_user_status ON trades(user_id, status);
CREATE INDEX idx_trades_symbol_status ON trades(symbol, status);
CREATE INDEX idx_trades_bybit_order ON trades(bybit_order_id);
```

### trading_logs
```sql
CREATE TABLE trading_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  log_type TEXT NOT NULL, -- 'info', 'warning', 'error', 'trade'
  message TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_logs_user_type ON trading_logs(user_id, log_type);
CREATE INDEX idx_logs_created ON trading_logs(created_at DESC);
```

### market_data
```sql
CREATE TABLE market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  price NUMERIC NOT NULL,
  volume NUMERIC,
  source TEXT DEFAULT 'bybit',
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_market_data_symbol ON market_data(symbol, timestamp DESC);
```

### candle_data (CRITICAL for Logic 2)
```sql
CREATE TABLE candle_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL, -- '1m', '5m', '15m', '1h', '4h', '1d'
  open_time TIMESTAMPTZ NOT NULL,
  close_time TIMESTAMPTZ NOT NULL,
  open_price NUMERIC NOT NULL,
  high_price NUMERIC NOT NULL,
  low_price NUMERIC NOT NULL,
  close_price NUMERIC NOT NULL,
  volume NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(symbol, timeframe, open_time)
);

CREATE INDEX idx_candle_data_symbol_time ON candle_data(symbol, timeframe, open_time DESC);
```

## 🔧 Edge Functions

### 1. bybit-api (API Proxy with Credential Fetching)

**Purpose**: Proxy all Bybit API calls with server-side credential management

**CRITICAL Implementation Details**:

#### Request Signature (HMAC SHA256)
```typescript
// Bybit V5 API requires signed requests for private endpoints
const timestamp = Date.now().toString();
const recvWindow = '5000';

// For GET requests
const queryString = new URLSearchParams({
  api_key: apiKey,
  timestamp,
  recv_window: recvWindow,
  ...params // endpoint-specific params
}).toString();

const signature = await generateHmacSha256(queryString, apiSecret);

// Headers for GET
const headers = {
  'X-BAPI-API-KEY': apiKey,
  'X-BAPI-SIGN': signature,
  'X-BAPI-TIMESTAMP': timestamp,
  'X-BAPI-RECV-WINDOW': recvWindow
};

// For POST requests
const signString = timestamp + apiKey + recvWindow + JSON.stringify(body);
const signature = await generateHmacSha256(signString, apiSecret);

const headers = {
  'X-BAPI-API-KEY': apiKey,
  'X-BAPI-SIGN': signature,
  'X-BAPI-TIMESTAMP': timestamp,
  'X-BAPI-RECV-WINDOW': recvWindow,
  'Content-Type': 'application/json'
};
```

#### HMAC SHA256 Generation
```typescript
async function generateHmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

#### Endpoints to Support
```typescript
// Market Data (Public)
GET /v5/market/tickers?category=spot&symbol=BTCUSDT
GET /v5/market/instruments-info?category=spot&symbol=BTCUSDT
GET /v5/market/kline?category=spot&symbol=BTCUSDT&interval=60&limit=200

// Account Info (Private - requires signature)
GET /v5/account/wallet-balance?accountType=UNIFIED
GET /v5/position/list?category=spot&symbol=BTCUSDT

// Trading (Private - requires signature)
POST /v5/order/create
POST /v5/order/cancel
GET /v5/order/realtime?category=spot&orderId=xxx
GET /v5/order/history?category=spot&limit=50
GET /v5/execution/list?category=spot&limit=50
```

#### Credential Fetching Flow
```typescript
// 1. Extract user_id from JWT
const user = await supabase.auth.getUser(req.headers.get('Authorization'));
const userId = user.data.user?.id;

// 2. Fetch active credentials from database
const { data: credentials } = await supabase
  .from('api_credentials')
  .select('api_key, api_secret, api_url, testnet')
  .eq('user_id', userId)
  .eq('is_active', true)
  .single();

// 3. Use credentials.api_url (DEMO or LIVE)
const baseUrl = credentials.api_url;
```

#### CORS Headers (MANDATORY)
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle OPTIONS preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

### 2. trading-engine (Main Trading Loop)

**Invoked by**: `pg_cron` every 30 seconds (configurable)

**Flow**:
```typescript
1. Position Monitoring
   - Fetch active trades from database
   - Poll Bybit for order status updates
   - Update trade status (pending → filled)
   - Place take-profit orders when buy fills

2. Market Scanning
   - Fetch current prices for configured trading_pairs
   - Store in market_data table
   - Fetch candle data for Logic 2 (from /v5/market/kline)

3. Signal Analysis
   - Run selected trading logic (Logic 1 or Logic 2)
   - Generate trading_signals with confidence scores
   - Store signals in database

4. Signal Execution
   - Validate signals against position limits
   - Check portfolio exposure
   - Place orders via bybit-api edge function
   - Record trades in database
   - Log all actions

5. EOD Management
   - Check if current time >= daily_reset_time
   - Close profitable trades only (profit_loss > 0)
   - Leave losing positions open
```

**Rate Limiting**:
```typescript
// Implement exponential backoff for Bybit API
const rateLimiter = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
};

// Bybit limits: 10 requests/second for spot trading
await sleep(100); // 100ms between requests
```

### 3. manual-trade-actions (User-Initiated Actions)

**Endpoints**:
- `POST /close-trade` - Close specific trade with premium pricing
- `POST /emergency-stop` - Stop engine and close all profitable positions
- `POST /cancel-order` - Cancel pending order

## 🎯 Dynamic Precision Management (CRITICAL)

### Problem Statement
Different trading pairs on Bybit require different decimal precision:
- BTC: 2 decimals (0.01 BTC), price: $50,123.45
- ETH: 4 decimals (0.0001 ETH), price: $2,345.67
- DOGE: 0 decimals (1 DOGE), price: $0.08234

Static precision causes order rejections.

### Bybit API Integration

#### Fetch Instrument Information
```typescript
// Endpoint: GET /v5/market/instruments-info
const response = await fetch(
  `${apiUrl}/v5/market/instruments-info?category=spot&symbol=${symbol}`
);

// Response structure
{
  "retCode": 0,
  "retMsg": "OK",
  "result": {
    "list": [{
      "symbol": "BTCUSDT",
      "baseCoin": "BTC",
      "quoteCoin": "USDT",
      "lotSizeFilter": {
        "basePrecision": "0.000001",  // 6 decimals for quantity
        "quotePrecision": "0.00000001",
        "minOrderQty": "0.000048",
        "maxOrderQty": "71.73956243",
        "minOrderAmt": "1",
        "maxOrderAmt": "2000000"
      },
      "priceFilter": {
        "tickSize": "0.01"  // 2 decimals for price
      }
    }]
  }
}
```

### Decimal Calculation Logic

#### Price Decimals (from tickSize)
```typescript
function calculatePriceDecimals(tickSize: string): number {
  // tickSize = "0.01" → 2 decimals
  // tickSize = "0.0001" → 4 decimals
  const num = parseFloat(tickSize);
  const str = num.toFixed(20);
  const dotIndex = str.indexOf('.');
  
  if (dotIndex === -1) return 0;
  
  let decimals = 0;
  for (let i = str.length - 1; i > dotIndex; i--) {
    if (str[i] !== '0') {
      decimals = i - dotIndex;
      break;
    }
  }
  return Math.min(decimals, 8); // Max 8 decimals
}
```

#### Quantity Decimals (from basePrecision)
```typescript
function calculateQuantityDecimals(basePrecision: string): number {
  // basePrecision = "0.000001" → 6 decimals
  return calculatePriceDecimals(basePrecision);
}
```

### Caching Architecture

#### InstrumentCache Service
```typescript
class InstrumentCache {
  private static cache: Map<string, {
    info: BybitInstrumentInfo;
    timestamp: number;
  }> = new Map();
  
  private static CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private static MAX_CACHE_SIZE = 100; // LRU eviction
  
  static getCached(symbol: string): BybitInstrumentInfo | null {
    const cached = this.cache.get(symbol);
    if (!cached) return null;
    
    // Check expiration
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(symbol);
      return null;
    }
    
    return cached.info;
  }
  
  static setCached(symbol: string, info: BybitInstrumentInfo): void {
    // LRU eviction if cache full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(symbol, {
      info,
      timestamp: Date.now()
    });
  }
}
```

### Service Layer Architecture

```typescript
// 1. InstrumentInfoFetcher: Fetches from Bybit API
class InstrumentInfoFetcher {
  static async fetch(symbol: string): Promise<BybitInstrumentInfo> {
    // Call /v5/market/instruments-info
    // Parse response and calculate decimals
  }
}

// 2. InstrumentCache: Manages caching
class InstrumentCache {
  // See above
}

// 3. BybitInstrumentService: Orchestrates fetching + caching
class BybitInstrumentService {
  static async getInstrumentInfo(symbol: string): Promise<BybitInstrumentInfo> {
    // 1. Check cache
    let info = InstrumentCache.getCached(symbol);
    if (info) return info;
    
    // 2. Fetch from API
    info = await InstrumentInfoFetcher.fetch(symbol);
    
    // 3. Cache result
    InstrumentCache.setCached(symbol, info);
    
    return info;
  }
}

// 4. BybitPrecisionFormatter: High-level API
class BybitPrecisionFormatter {
  static async formatPrice(symbol: string, price: number): Promise<string> {
    const info = await BybitInstrumentService.getInstrumentInfo(symbol);
    return price.toFixed(info.priceDecimals);
  }
  
  static async formatQuantity(symbol: string, qty: number): Promise<string> {
    const info = await BybitInstrumentService.getInstrumentInfo(symbol);
    return qty.toFixed(info.quantityDecimals);
  }
  
  static async validateOrder(symbol: string, price: number, qty: number): Promise<boolean> {
    const info = await BybitInstrumentService.getInstrumentInfo(symbol);
    
    // Check minimum quantity
    if (qty < parseFloat(info.minOrderQty)) return false;
    
    // Check minimum order value
    const orderValue = price * qty;
    if (orderValue < parseFloat(info.minOrderAmt)) return false;
    
    return true;
  }
}
```

### Error Handling & Fallbacks

```typescript
// Graceful degradation if API fails
try {
  const info = await BybitInstrumentService.getInstrumentInfo(symbol);
  return price.toFixed(info.priceDecimals);
} catch (error) {
  console.error(`Precision fetch failed for ${symbol}:`, error);
  
  // Fallback to safe default (4 decimals)
  return price.toFixed(4);
}
```

### Integration Points

1. **Order Placement**: Format price and quantity before submission
2. **Trade Display**: Format values for UI display
3. **Validation**: Check orders meet Bybit requirements
4. **Batch Operations**: Fetch multiple symbols at once

## 🔄 Order Fill Checking System

### Position Monitoring Service
```typescript
class PositionMonitorService {
  async checkOrderFills(userId: string): Promise<void> {
    // 1. Fetch pending trades
    const { data: pendingTrades } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .eq('side', 'Buy');
    
    // 2. Check each order status via Bybit API
    for (const trade of pendingTrades) {
      const orderStatus = await this.checkBybitOrderStatus(trade.bybit_order_id);
      
      if (orderStatus.orderStatus === 'Filled') {
        // 3. Update trade as filled
        await this.markTradeAsFilled(trade, orderStatus.avgPrice);
        
        // 4. Place take-profit sell order
        await this.placeTakeProfitOrder(trade, orderStatus.avgPrice);
      }
    }
  }
  
  private async placeTakeProfitOrder(buyTrade: Trade, fillPrice: number): Promise<void> {
    const config = await this.getConfig(buyTrade.user_id);
    const takeProfitPrice = fillPrice * (1 + config.take_profit_percent / 100);
    
    // Format with precision
    const formattedPrice = await BybitPrecisionFormatter.formatPrice(
      buyTrade.symbol,
      takeProfitPrice
    );
    
    // Place limit sell order
    await this.placeOrder({
      symbol: buyTrade.symbol,
      side: 'Sell',
      orderType: 'Limit',
      qty: buyTrade.quantity,
      price: formattedPrice
    });
  }
}
```

### Real-Time Status Polling
```typescript
// In trading-engine edge function
const POLL_INTERVAL = 5000; // 5 seconds

async function monitorActiveOrders() {
  while (engineRunning) {
    await positionMonitorService.checkOrderFills(userId);
    await sleep(POLL_INTERVAL);
  }
}
```

## 📊 Candle Data Management

### Fetching Candle Data
```typescript
// Endpoint: GET /v5/market/kline
async function fetchCandleData(
  symbol: string,
  interval: string, // '1', '5', '15', '60', '240', 'D'
  limit: number = 200
): Promise<CandleData[]> {
  const response = await fetch(
    `${apiUrl}/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  
  const data = await response.json();
  
  // Response: [[startTime, open, high, low, close, volume, turnover], ...]
  return data.result.list.map(candle => ({
    openTime: new Date(parseInt(candle[0])),
    closeTime: new Date(parseInt(candle[0]) + getIntervalMs(interval)),
    openPrice: parseFloat(candle[1]),
    highPrice: parseFloat(candle[2]),
    lowPrice: parseFloat(candle[3]),
    closePrice: parseFloat(candle[4]),
    volume: parseFloat(candle[5])
  }));
}
```

### Storing Candle Data
```typescript
async function storeCandleData(symbol: string, timeframe: string, candles: CandleData[]) {
  const { error } = await supabase
    .from('candle_data')
    .upsert(
      candles.map(c => ({
        symbol,
        timeframe,
        open_time: c.openTime,
        close_time: c.closeTime,
        open_price: c.openPrice,
        high_price: c.highPrice,
        low_price: c.lowPrice,
        close_price: c.closePrice,
        volume: c.volume
      })),
      { onConflict: 'symbol,timeframe,open_time' }
    );
}
```

### Using Candle Data in Logic 2
```typescript
class DataDrivenSupportAnalyzer {
  async analyzeSupport(symbol: string, config: TradingConfig): Promise<SupportLevel[]> {
    // 1. Fetch candle data from database
    const { data: candles } = await supabase
      .from('candle_data')
      .select('*')
      .eq('symbol', symbol)
      .eq('timeframe', config.chart_timeframe)
      .order('open_time', { ascending: false })
      .limit(config.swing_analysis_bars);
    
    // 2. Calculate ATR
    const atr = this.calculateATR(candles);
    
    // 3. Find swing lows
    const swingLows = this.findSwingLows(candles);
    
    // 4. Apply Fibonacci retracements
    const fibLevels = this.calculateFibonacci(candles, config.fibonacci_sensitivity);
    
    // 5. Analyze volume
    const volumeProfile = this.analyzeVolume(candles, config.volume_lookback_periods);
    
    // 6. Combine signals
    return this.identifySupportLevels(swingLows, fibLevels, volumeProfile, atr);
  }
}
```

## ⚙️ pg_cron Setup (CRITICAL)

### Enable Required Extensions
```sql
-- Run this SQL in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Create Cron Job
```sql
-- Schedule trading-engine to run every 30 seconds
SELECT cron.schedule(
  'trading-engine-main-loop',
  '*/30 * * * * *', -- Every 30 seconds (cron supports seconds in Supabase)
  $$
  SELECT
    net.http_post(
      url := 'https://twezspyyovvcemfeziif.supabase.co/functions/v1/trading-engine',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3ZXpzcHl5b3Z2Y2VtZmV6aWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MjYzODIsImV4cCI6MjA2NTAwMjM4Mn0.5Rv485X-LK9rLw6AfIGeM14elucKadRuU41VnyUIr-4"}'::jsonb,
      body := '{"action": "run_trading_loop"}'::jsonb
    ) AS request_id;
  $$
);
```

### Verify Cron Job
```sql
-- List all cron jobs
SELECT * FROM cron.job;

-- View cron job run history
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Unschedule if needed
SELECT cron.unschedule('trading-engine-main-loop');
```

### Dynamic Interval Configuration
```typescript
// When user changes main_loop_interval_seconds in config
async function updateCronInterval(newIntervalSeconds: number) {
  // Unschedule old job
  await supabase.rpc('unschedule_cron', { job_name: 'trading-engine-main-loop' });
  
  // Schedule new job with updated interval
  const cronExpression = `*/${newIntervalSeconds} * * * * *`;
  await supabase.rpc('schedule_cron', {
    job_name: 'trading-engine-main-loop',
    schedule: cronExpression,
    command: '...' // Same as above
  });
}
```

## 🔍 Signal Confidence Scoring

### Confidence Calculation
```typescript
interface SignalConfidence {
  score: number; // 0-100
  factors: {
    priceAtSupport: number; // 0-30 points
    volumeConfirmation: number; // 0-25 points
    trendAlignment: number; // 0-25 points
    fibonacciLevel: number; // 0-20 points
  };
}

function calculateConfidence(
  currentPrice: number,
  supportLevel: number,
  candles: CandleData[],
  config: TradingConfig
): SignalConfidence {
  const factors = {
    // Price proximity to support (closer = higher score)
    priceAtSupport: calculatePriceProximity(currentPrice, supportLevel),
    
    // Volume spike confirmation
    volumeConfirmation: checkVolumeSpike(candles, config.volume_lookback_periods),
    
    // Overall trend alignment
    trendAlignment: analyzeTrend(candles),
    
    // Fibonacci level alignment
    fibonacciLevel: checkFibonacciAlignment(currentPrice, candles, config.fibonacci_sensitivity)
  };
  
  const score = Object.values(factors).reduce((sum, val) => sum + val, 0);
  
  return { score, factors };
}
```

### Signal Prioritization
```typescript
// Execute signals with highest confidence first
const signals = await getUnprocessedSignals(userId);
const sortedSignals = signals.sort((a, b) => b.confidence - a.confidence);

for (const signal of sortedSignals) {
  if (signal.confidence >= 70) { // Threshold
    await executeSignal(signal);
  }
}
```

## 📈 Reconciliation System

### Periodic Sync with Bybit
```typescript
class ReconciliationService {
  async reconcileTrades(userId: string): Promise<void> {
    // 1. Fetch all active trades from database
    const { data: dbTrades } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'filled']);
    
    // 2. Fetch actual orders from Bybit
    const bybitOrders = await this.fetchBybitOrders(userId);
    
    // 3. Compare and sync
    for (const dbTrade of dbTrades) {
      const bybitOrder = bybitOrders.find(o => o.orderId === dbTrade.bybit_order_id);
      
      if (!bybitOrder) {
        // Order doesn't exist on Bybit - mark as error
        await this.markTradeAsError(dbTrade, 'Order not found on Bybit');
      } else if (bybitOrder.orderStatus !== dbTrade.status) {
        // Status mismatch - update database
        await this.updateTradeStatus(dbTrade, bybitOrder);
      }
    }
    
    // 4. Detect orphaned Bybit orders (exist on Bybit but not in DB)
    const orphanedOrders = bybitOrders.filter(
      bo => !dbTrades.find(dt => dt.bybit_order_id === bo.orderId)
    );
    
    if (orphanedOrders.length > 0) {
      await this.logOrphanedOrders(orphanedOrders);
    }
  }
}

// Run reconciliation every 5 minutes
SELECT cron.schedule(
  'reconciliation-job',
  '*/5 * * * *', -- Every 5 minutes
  $$ SELECT net.http_post(...) $$
);
```

## 🎨 UI Component Guidelines

### Shadcn/UI Components to Use
- `Card`, `CardHeader`, `CardTitle`, `CardContent` for stat displays
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` for data tables
- `Button` with variants (default, destructive, outline, ghost)
- `Badge` for status indicators (success, warning, error)
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` for configuration
- `Dialog`, `DialogTrigger`, `DialogContent` for modals
- `Select`, `SelectTrigger`, `SelectContent` for dropdowns
- `Input`, `Label` for forms
- `Switch` for boolean toggles
- `Slider` for numeric ranges
- `Textarea` for notes
- `Alert`, `AlertTitle`, `AlertDescription` for notifications
- `Progress` for loading states

### Real-Time Updates
```typescript
// Use Supabase Realtime for live data
const subscription = supabase
  .channel('trades-channel')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'trades',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // Update UI with new trade data
    setTrades(prev => [...prev, payload.new]);
  })
  .subscribe();
```

### CSV Export Implementation
```typescript
function exportToCSV(trades: Trade[]) {
  const headers = ['Date', 'Symbol', 'Side', 'Quantity', 'Price', 'P&L', 'Status'];
  const rows = trades.map(t => [
    new Date(t.created_at).toLocaleString(),
    t.symbol,
    t.side,
    t.quantity,
    t.price,
    t.profit_loss || 0,
    t.status
  ]);
  
  const csv = [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trades-${new Date().toISOString()}.csv`;
  a.click();
}
```

## 🛡️ Validation Chain

### Pre-Trade Validation
```typescript
class ValidationChain {
  async validateTrade(signal: Signal, config: TradingConfig): Promise<ValidationResult> {
    // 1. Check position limits
    const positionCheck = await this.checkPositionLimits(signal.symbol, config);
    if (!positionCheck.valid) {
      return { valid: false, reason: positionCheck.reason };
    }
    
    // 2. Check portfolio exposure
    const exposureCheck = await this.checkPortfolioExposure(config);
    if (!exposureCheck.valid) {
      return { valid: false, reason: exposureCheck.reason };
    }
    
    // 3. Check account balance
    const balanceCheck = await this.checkAccountBalance(signal, config);
    if (!balanceCheck.valid) {
      return { valid: false, reason: balanceCheck.reason };
    }
    
    // 4. Check order precision
    const precisionCheck = await this.checkOrderPrecision(signal);
    if (!precisionCheck.valid) {
      return { valid: false, reason: precisionCheck.reason };
    }
    
    // 5. Check minimum order value
    const minValueCheck = await this.checkMinimumOrderValue(signal);
    if (!minValueCheck.valid) {
      return { valid: false, reason: minValueCheck.reason };
    }
    
    return { valid: true };
  }
}
```

## 📊 Trading Engine State Management

### Engine Status
```typescript
interface EngineState {
  status: 'running' | 'stopped' | 'error';
  lastRun: Date;
  nextRun: Date;
  currentCycle: {
    positionsScanned: number;
    signalsGenerated: number;
    ordersPlaced: number;
    errors: string[];
  };
  health: {
    apiConnected: boolean;
    dbConnected: boolean;
    lastError: string | null;
  };
}

// Store in trading_logs or separate engine_state table
async function updateEngineState(state: EngineState) {
  await supabase
    .from('engine_state')
    .upsert({ user_id: userId, state, updated_at: new Date() });
}

// Real-time engine status on dashboard
const { data } = await supabase
  .from('engine_state')
  .select('*')
  .eq('user_id', userId)
  .single();
```

## 🔧 Tech Stack Requirements

### Frontend
- React 18+ with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Shadcn/UI for components
- React Router for routing
- TanStack Query for data fetching
- Zustand or React Context for state

### Backend
- Supabase PostgreSQL (with RLS enabled)
- Supabase Auth (JWT-based)
- Supabase Edge Functions (Deno runtime)
- pg_cron for scheduling
- pg_net for HTTP requests

### External APIs
- Bybit API v5
  - DEMO: https://api-demo.bybit.com
  - LIVE: https://api.bybit.com
- Spot trading category only

## 🧪 Testing Strategy

### Unit Tests (Optional but Recommended)
- Test precision calculation logic
- Test signal confidence scoring
- Test validation chain
- Test candle data analysis

### Integration Tests (Required)
Implement in System Validation page:
1. API connectivity test
2. Credential validation test
3. Account balance fetch test
4. Market data fetch test
5. Order placement test (dry run)
6. Signal generation test
7. Order status polling test

### Manual Testing Checklist
- [ ] DEMO trading works end-to-end
- [ ] LIVE trading credentials switch properly
- [ ] Position limits enforced
- [ ] EOD management closes profitable trades
- [ ] Manual close works with premium pricing
- [ ] Trading engine starts/stops correctly
- [ ] Real-time updates work on dashboard
- [ ] CSV export downloads correct data
- [ ] Logs display correctly with filtering
- [ ] System validation tests all pass

## 📝 Implementation Checklist

### Phase 1: Database & Auth
- [ ] Create all database tables with indexes
- [ ] Enable RLS on all tables
- [ ] Create RLS policies for each table
- [ ] Enable pg_cron and pg_net extensions
- [ ] Set up Supabase Auth

### Phase 2: Edge Functions
- [ ] Implement bybit-api edge function with signature logic
- [ ] Implement trading-engine edge function
- [ ] Implement manual-trade-actions edge function
- [ ] Test all edge functions with Postman/curl
- [ ] Add comprehensive logging to all functions

### Phase 3: Precision Management
- [ ] Create InstrumentInfoFetcher service
- [ ] Create InstrumentCache service
- [ ] Create BybitInstrumentService
- [ ] Create BybitPrecisionFormatter
- [ ] Add candle_data table and fetching logic

### Phase 4: Frontend UI
- [ ] Implement Dashboard page
- [ ] Implement Trading Configuration page
- [ ] Implement API Credentials page
- [ ] Implement Trading Reports page
- [ ] Implement Trading Logs page
- [ ] Implement System Validation page
- [ ] Add real-time subscriptions

### Phase 5: Trading Logic
- [ ] Implement Logic 1 (Base Support Detection)
- [ ] Implement Logic 2 (Data-Driven Support Analysis)
- [ ] Implement order fill checking
- [ ] Implement take-profit order placement
- [ ] Implement EOD management
- [ ] Implement reconciliation system

### Phase 6: Testing & Deployment
- [ ] Test all system validation checks
- [ ] Test DEMO trading end-to-end
- [ ] Set up pg_cron job
- [ ] Test engine start/stop
- [ ] Test manual actions
- [ ] Deploy to production

## 🚨 Critical Reminders

1. **NEVER expose API credentials client-side**
2. **Always use RLS policies on all tables**
3. **Always fetch credentials server-side in edge functions**
4. **Always use HMAC SHA256 signatures for Bybit private endpoints**
5. **Always implement precision management for all symbols**
6. **Always validate orders before submission**
7. **Always implement rate limiting**
8. **Always log all trading actions**
9. **Always handle errors gracefully**
10. **Always test with DEMO before going LIVE**

## 📚 Documentation References

- [Bybit API v5 Documentation](https://bybit-exchange.github.io/docs/v5/intro)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [pg_cron Documentation](https://github.com/citusdata/pg_cron)
- [Shadcn/UI Components](https://ui.shadcn.com/)

---

This enhanced prompt includes ALL critical implementation details needed to build a production-ready Bybit trading bot with proper security, precision management, order tracking, and comprehensive testing.
