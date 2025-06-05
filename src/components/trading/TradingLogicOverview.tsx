
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  Clock, 
  Target, 
  DollarSign, 
  BarChart3, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Activity
} from 'lucide-react';

const TradingLogicOverview = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Complete Trading Bot Logic Flow
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Main Trading Loop */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">1. Main Trading Loop (Every 30 seconds)</h3>
            </div>
            <div className="pl-7 space-y-2">
              <p className="text-sm text-gray-600">The bot runs continuously with configurable intervals</p>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• Checks if trading is active in configuration</li>
                <li>• Executes trading cycle if enabled</li>
                <li>• Handles errors and logs all activities</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* Position Monitoring */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">2. Position Monitoring</h3>
            </div>
            <div className="pl-7 space-y-2">
              <p className="text-sm text-gray-600">Continuously tracks all active positions</p>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• Fetches current market prices for active trades</li>
                <li>• Calculates real-time P&L for each position</li>
                <li>• Updates market data in database</li>
                <li>• Checks for take-profit conditions</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* Market Data Scanning */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold">3. Market Data Scanning</h3>
            </div>
            <div className="pl-7 space-y-2">
              <p className="text-sm text-gray-600">Scans configured trading pairs for opportunities</p>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• Fetches latest prices for all configured pairs</li>
                <li>• Analyzes 4-hour candle data (128 candles)</li>
                <li>• Identifies support levels using technical analysis</li>
                <li>• Filters based on support strength and touch count</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* Signal Analysis */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h3 className="text-lg font-semibold">4. Signal Analysis & Generation</h3>
            </div>
            <div className="pl-7 space-y-2">
              <p className="text-sm text-gray-600">Generates buy signals based on support levels</p>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• Checks if price is within support bounds (±2% to ±5%)</li>
                <li>• Calculates entry price with offset (+0.5% above support)</li>
                <li>• Validates support strength (minimum 30% confidence)</li>
                <li>• Stores signals in database for execution</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* Signal Execution */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">5. Signal Execution</h3>
            </div>
            <div className="pl-7 space-y-2">
              <p className="text-sm text-gray-600">Executes validated buy signals</p>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• Checks position limits (max 5 active pairs, 2 per symbol)</li>
                <li>• Calculates quantity based on $100 max order size</li>
                <li>• Formats price and quantity to Bybit specifications</li>
                <li>• Places limit buy order on Bybit exchange</li>
                <li>• Immediately places take-profit limit sell order (+1%)</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* End of Day Management */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-600" />
              <h3 className="text-lg font-semibold">6. End of Day Management</h3>
            </div>
            <div className="pl-7 space-y-2">
              <p className="text-sm text-gray-600">Optional automatic position closure</p>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• Runs at configured end-of-day time (default: midnight)</li>
                <li>• Closes positions with profit above threshold (0.1%)</li>
                <li>• Places market sell orders for selected positions</li>
                <li>• Updates trade records with final P&L</li>
              </ul>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Trading Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Key Trading Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Badge variant="outline">Position Limits</Badge>
              <ul className="text-sm space-y-1">
                <li>• Max 5 active trading pairs</li>
                <li>• Max 2 positions per symbol</li>
                <li>• Max $100 per order</li>
                <li>• 25% max portfolio exposure</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Badge variant="outline">Entry Strategy</Badge>
              <ul className="text-sm space-y-1">
                <li>• Support level identification</li>
                <li>• +0.5% entry offset above support</li>
                <li>• Limit buy orders only</li>
                <li>• 128 candle analysis window</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Badge variant="outline">Exit Strategy</Badge>
              <ul className="text-sm space-y-1">
                <li>• +1% take-profit target</li>
                <li>• Automatic limit sell orders</li>
                <li>• End-of-day closure option</li>
                <li>• Manual close capability</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Badge variant="outline">Risk Management</Badge>
              <ul className="text-sm space-y-1">
                <li>• Support strength validation</li>
                <li>• Price bounds checking (±2% to ±5%)</li>
                <li>• Minimum notional validation</li>
                <li>• Position size limits</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Badge variant="outline">Supported Pairs</Badge>
              <ul className="text-sm space-y-1">
                <li>• BTCUSDT, ETHUSDT, SOLUSDT</li>
                <li>• BNBUSDT, LTCUSDT, ADAUSDT</li>
                <li>• XRPUSDT, POLUSDT, FETUSDT</li>
                <li>• XLMUSDT</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Badge variant="outline">Execution Details</Badge>
              <ul className="text-sm space-y-1">
                <li>• Real Bybit API integration</li>
                <li>• Demo trading environment</li>
                <li>• Comprehensive logging</li>
                <li>• Error handling & retry logic</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Implementation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Technical Implementation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold">Data Flow</h4>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>1. Market data → Support analysis</li>
                <li>2. Support levels → Signal generation</li>
                <li>3. Signals → Position validation</li>
                <li>4. Validation → Order execution</li>
                <li>5. Orders → Position monitoring</li>
                <li>6. Monitoring → P&L calculation</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold">Error Handling</h4>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• API connection failures</li>
                <li>• Invalid order parameters</li>
                <li>• Insufficient balance checks</li>
                <li>• Market data unavailability</li>
                <li>• Position limit violations</li>
                <li>• Decimal precision errors</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TradingLogicOverview;
