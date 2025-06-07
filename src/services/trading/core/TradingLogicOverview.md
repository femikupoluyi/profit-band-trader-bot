
# Complete Trading Bot Logic Overview

## System Architecture

The trading bot consists of several core services that work together in a main loop:

### 1. Main Trading Engine (`MainTradingEngine.ts`)
- **Purpose**: Orchestrates all trading activities
- **Main Loop Interval**: Configurable (default 30 seconds)
- **Components**:
  - Position Monitor Service
  - Market Data Scanner Service  
  - Signal Analysis Service
  - Signal Execution Service
  - End-of-Day Manager Service
  - Manual Close Service

### 2. Core Trading Loop Workflow

#### Step 1: Position Monitoring & Order Fills (`PositionMonitorService.ts`)
- **Real Bybit Order Checking**: Only checks trades with actual Bybit order IDs
- **Fill Confirmation**: Verifies order status directly from Bybit API
- **Take-Profit Monitoring**: Monitors filled positions for profit targets
- **Status Updates**: Updates trade status based on real Bybit confirmations

#### Step 2: Market Data Scanning (`MarketDataScannerService.ts`)
- **Price Collection**: Fetches current market prices for all configured pairs
- **Data Storage**: Stores market data for analysis
- **Pair Filtering**: Only scans configured trading pairs

#### Step 3: Signal Analysis (`SignalAnalysisService.ts`)
- **Support Level Detection**: Analyzes price history for support levels
- **Signal Generation**: Creates buy signals when price approaches support
- **Confidence Scoring**: Assigns confidence levels to signals
- **Technical Analysis**: Uses candlestick data for pattern recognition

#### Step 4: Signal Execution (`SignalExecutionService.ts`)
- **Position Limit Validation**: 
  - Max active pairs check
  - Max positions per pair check (configured limit: 2)
  - Portfolio exposure validation
- **Order Placement**: Places REAL limit buy orders on Bybit
- **Take-Profit Setup**: Automatically places take-profit sell orders
- **Risk Management**: Validates order sizes and minimum notionals

#### Step 5: End-of-Day Management (`EndOfDayManagerService.ts`)
- **Profit-Only Closure**: Only closes profitable positions at EOD
- **Loss Protection**: Leaves losing trades open to continue next day
- **No Trading Interference**: Losing trades don't affect next day's pair limits

## Position Limits & Risk Management

### Maximum Positions Per Pair
- **Configuration**: `max_positions_per_pair` (default: 2)
- **Enforcement**: Checked before every signal execution
- **Current Issue**: Logic needs strengthening to prevent exceeding limits

### Portfolio Limits
- **Max Active Pairs**: `max_active_pairs` (default: 20)
- **Max Order Amount**: `max_order_amount_usd` (default: $50)
- **Portfolio Exposure**: `max_portfolio_exposure_percent` (default: 20%)

### End-of-Day Logic (Fixed)
```
IF auto_close_at_end_of_day = true AND current_time >= 23:00:
  FOR each open trade today:
    calculate_profit_loss()
    IF profit_loss > 0:
      close_trade_with_premium()
    ELSE:
      leave_trade_open() // Key fix: don't close at loss
```

## Order Types & Execution

### Entry Orders
- **Type**: Limit Buy Orders
- **Price**: Support level + entry offset
- **Quantity**: Calculated from max order amount USD
- **Execution**: Real Bybit API calls only

### Exit Orders  
- **Take-Profit**: Automatic limit sell at entry + profit percentage
- **Manual Close**: Database-only closure (for demo/testing)
- **EOD Close**: Market sell for profitable positions only

## Signal Generation Logic

### Support Level Detection
1. **Candlestick Analysis**: Uses configurable candle count (default: 128)
2. **Support Identification**: Finds significant low points
3. **Threshold Validation**: Ensures support is X% below current price
4. **Multiple Position Logic**: Allows new positions if price drops significantly

### Signal Validation
- Position limits check
- Account balance verification
- Minimum notional validation
- Technical indicator confirmation

## Configuration Parameters

### Trading Behavior
- `main_loop_interval_seconds`: How often the bot runs (30s)
- `take_profit_percent`: Profit target (1.0%)
- `entry_offset_percent`: Buffer below support (0.5%)
- `support_candle_count`: Lookback period (128 candles)

### Risk Management  
- `max_active_pairs`: Maximum trading pairs (20)
- `max_positions_per_pair`: Positions per symbol (2)
- `max_order_amount_usd`: Order size ($50)
- `new_support_threshold_percent`: New position trigger (1.0%)

### End-of-Day
- `auto_close_at_end_of_day`: Enable EOD management (false)
- `eod_close_premium_percent`: EOD sell premium (0.1%)
- `manual_close_premium_percent`: Manual close premium (0.1%)

## Current Issues & Fixes Applied

### 1. Manual Close Errors ✅ FIXED
- **Problem**: Database constraints preventing trade closure
- **Solution**: Enhanced error handling and constraint bypass for manual closes

### 2. Position Limit Violations ✅ FIXED  
- **Problem**: Bot creating more than 2 positions per pair
- **Solution**: Strengthened validation in SignalExecutionService

### 3. EOD Loss Closure ✅ FIXED
- **Problem**: Bot closing losing trades at end of day
- **Solution**: Modified EndOfDayManagerService to only close profitable trades

### 4. Mock Order Issues ✅ PREVIOUSLY FIXED
- **Problem**: System using mock orders and false fill reporting
- **Solution**: All services now use real Bybit API exclusively

## Monitoring & Logging

### Trade Status Flow
```
pending → filled → closed
    ↓
cancelled (if Bybit rejects)
```

### Log Types
- `order_placed`: Real Bybit orders
- `trade_filled`: Confirmed fills from Bybit
- `position_closed`: Trade closures
- `signal_rejected`: Invalid signals
- `system_error`: Technical issues

### Real-Time Monitoring
- Active positions dashboard
- P&L tracking
- Order status verification
- System health logs
