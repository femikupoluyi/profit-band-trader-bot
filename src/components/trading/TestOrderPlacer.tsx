
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { BybitService } from '@/services/bybitService';
import { supabase } from '@/integrations/supabase/client';

const TestOrderPlacer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPlacing, setIsPlacing] = useState(false);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [orderAmount, setOrderAmount] = useState('50');
  const [limitPrice, setLimitPrice] = useState('');
  
  const testSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'
  ];

  const placeTestOrder = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to place test orders.",
        variant: "destructive",
      });
      return;
    }

    if (!limitPrice || parseFloat(limitPrice) <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid limit price.",
        variant: "destructive",
      });
      return;
    }

    setIsPlacing(true);

    try {
      console.log('🧪 ===== PLACING TEST LIMIT ORDER =====');
      console.log(`📊 Symbol: ${symbol}`);
      console.log(`💰 Order Amount: $${orderAmount}`);
      console.log(`📈 Limit Price: $${limitPrice}`);

      toast({
        title: "Test Order Started",
        description: `Placing test limit order for ${symbol}...`,
      });

      // Get API credentials
      const { data: credentials, error: credError } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (credError || !credentials) {
        throw new Error('API credentials not found. Please configure your Bybit API credentials.');
      }

      // Initialize Bybit service
      const bybitService = new BybitService(
        credentials.api_key,
        credentials.api_secret,
        credentials.testnet,
        credentials.api_url
      );

      // Get current market price for reference
      const marketData = await bybitService.getMarketPrice(symbol);
      const currentPrice = marketData.price;
      console.log(`📊 Current market price for ${symbol}: $${currentPrice}`);

      // Calculate quantity based on order amount and limit price
      const entryPrice = parseFloat(limitPrice);
      const quantity = parseFloat(orderAmount) / entryPrice;
      const takeProfitPrice = entryPrice * 1.02; // 2% profit

      console.log(`📦 Calculated quantity: ${quantity.toFixed(6)}`);
      console.log(`🎯 Take-profit price: $${takeProfitPrice.toFixed(6)}`);

      // Format values for Bybit (using standard 6 decimal places)
      const formattedQuantity = quantity.toFixed(6);
      const formattedEntryPrice = entryPrice.toFixed(6);
      const formattedTakeProfitPrice = takeProfitPrice.toFixed(6);

      console.log('📝 Placing BUY limit order...');

      // Place buy limit order
      const buyOrderResult = await bybitService.placeOrder({
        category: 'spot',
        symbol: symbol,
        side: 'Buy',
        orderType: 'Limit',
        qty: formattedQuantity,
        price: formattedEntryPrice,
        timeInForce: 'GTC'
      });

      console.log('📄 Buy order result:', buyOrderResult);

      if (buyOrderResult.retCode !== 0) {
        throw new Error(`Buy order failed: ${buyOrderResult.retMsg || 'Unknown error'}`);
      }

      const buyOrderId = buyOrderResult.result?.orderId;
      if (!buyOrderId) {
        throw new Error('No order ID returned from buy order');
      }

      console.log(`✅ BUY order placed successfully: ${buyOrderId}`);

      // Wait a moment before placing take-profit order
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('📝 Placing SELL take-profit order...');

      // Place take-profit sell order
      const sellOrderResult = await bybitService.placeOrder({
        category: 'spot',
        symbol: symbol,
        side: 'Sell',
        orderType: 'Limit',
        qty: formattedQuantity,
        price: formattedTakeProfitPrice,
        timeInForce: 'GTC'
      });

      console.log('📄 Sell order result:', sellOrderResult);

      if (sellOrderResult.retCode !== 0) {
        console.warn(`Take-profit order failed: ${sellOrderResult.retMsg || 'Unknown error'}`);
        toast({
          title: "Partial Success",
          description: `Buy order placed (${buyOrderId}) but take-profit order failed: ${sellOrderResult.retMsg}`,
          variant: "destructive",
        });
      } else {
        const sellOrderId = sellOrderResult.result?.orderId;
        console.log(`✅ SELL order placed successfully: ${sellOrderId}`);
        
        toast({
          title: "Test Orders Placed Successfully! 🎉",
          description: `Buy Order: ${buyOrderId}, Take-Profit: ${sellOrderId}`,
        });
      }

      // Record in database for tracking
      const { error: insertError } = await supabase
        .from('trades')
        .insert({
          user_id: user.id,
          symbol: symbol,
          side: 'buy',
          quantity: parseFloat(formattedQuantity),
          price: parseFloat(formattedEntryPrice),
          status: 'pending',
          order_type: 'limit',
          bybit_order_id: buyOrderId
        });

      if (insertError) {
        console.warn('Failed to record trade in database:', insertError);
      }

      console.log('🎉 ===== TEST ORDER PLACEMENT COMPLETE =====');

    } catch (error) {
      console.error('❌ Test order placement failed:', error);
      toast({
        title: "Test Order Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsPlacing(false);
    }
  };

  const getCurrentMarketPrice = async () => {
    if (!user) return;

    try {
      const { data: credentials } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!credentials) return;

      const bybitService = new BybitService(
        credentials.api_key,
        credentials.api_secret,
        credentials.testnet,
        credentials.api_url
      );

      const marketData = await bybitService.getMarketPrice(symbol);
      const suggestedPrice = (marketData.price * 0.99).toFixed(6); // 1% below market
      setLimitPrice(suggestedPrice);
      
      toast({
        title: "Price Updated",
        description: `Set limit price to $${suggestedPrice} (1% below market: $${marketData.price.toFixed(6)})`,
      });
    } catch (error) {
      console.error('Failed to get market price:', error);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>🧪 Direct Bybit Order Test</CardTitle>
        <CardDescription>
          Place a real limit order directly to Bybit API to test connectivity and order placement.
          This bypasses all trading logic and places orders immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="symbol">Trading Symbol</Label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {testSymbols.map((sym) => (
                  <SelectItem key={sym} value={sym}>
                    {sym}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Order Amount (USD)</Label>
            <Input
              id="amount"
              type="number"
              value={orderAmount}
              onChange={(e) => setOrderAmount(e.target.value)}
              placeholder="50"
              min="10"
              step="10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="limitPrice">Limit Price (USD)</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={getCurrentMarketPrice}
              disabled={isPlacing}
            >
              Get Market Price (-1%)
            </Button>
          </div>
          <Input
            id="limitPrice"
            type="number"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder="Enter limit price"
            step="0.000001"
          />
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Test Order Details</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Buy {symbol} at ${limitPrice || '0.000000'} (Limit Order)</li>
            <li>• Quantity: {limitPrice ? (parseFloat(orderAmount) / parseFloat(limitPrice || '1')).toFixed(6) : '0.000000'}</li>
            <li>• Take-Profit at ${limitPrice ? (parseFloat(limitPrice || '0') * 1.02).toFixed(6) : '0.000000'} (+2%)</li>
            <li>• Order Value: ${orderAmount}</li>
          </ul>
        </div>

        <Button 
          onClick={placeTestOrder}
          disabled={isPlacing || !limitPrice}
          className="w-full"
          size="lg"
        >
          {isPlacing ? "Placing Test Orders..." : "🚀 Place Test Limit Order"}
        </Button>

        <div className="text-xs text-gray-500 space-y-1">
          <p>⚠️ This will place REAL orders on Bybit!</p>
          <p>✅ Orders are placed in the configured environment (demo/mainnet)</p>
          <p>📊 Check your Bybit account to verify order placement</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TestOrderPlacer;
