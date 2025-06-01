
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { TestResult } from './types';

export const useTradingSystemTests = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const runSystemTests = async () => {
    if (!user) return;
    
    setIsTesting(true);
    setTestResults([]);
    
    const results: TestResult[] = [];
    
    try {
      // Test 1: Check API credentials
      results.push({ test: 'API Credentials', status: 'running', message: 'Checking Bybit API credentials...' });
      setTestResults([...results]);
      
      const { data: credentials } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange_name', 'bybit')
        .single();
      
      if (credentials && credentials.api_key && credentials.api_secret) {
        results[0] = { test: 'API Credentials', status: 'success', message: '✅ API credentials configured' };
      } else {
        results[0] = { test: 'API Credentials', status: 'error', message: '❌ API credentials not found' };
      }
      setTestResults([...results]);
      
      // Test 2: Test Bybit Demo API connection
      results.push({ test: 'Bybit API Connection', status: 'running', message: 'Testing Bybit Demo API...' });
      setTestResults([...results]);
      
      try {
        const { data: apiResponse, error: apiError } = await supabase.functions.invoke('bybit-api', {
          body: {
            endpoint: '/v5/market/tickers',
            method: 'GET',
            params: {
              category: 'spot',
              symbol: 'BTCUSDT'
            },
            isDemoTrading: true
          }
        });
        
        if (apiError) {
          results[1] = { test: 'Bybit API Connection', status: 'error', message: `❌ API Error: ${apiError.message}` };
        } else if (apiResponse?.retCode === 0) {
          results[1] = { test: 'Bybit API Connection', status: 'success', message: '✅ Bybit Demo API working' };
        } else {
          results[1] = { test: 'Bybit API Connection', status: 'error', message: `❌ API returned error: ${apiResponse?.retMsg}` };
        }
      } catch (error) {
        results[1] = { test: 'Bybit API Connection', status: 'error', message: `❌ Connection failed: ${error}` };
      }
      setTestResults([...results]);
      
      // Test 3: Check trading configuration
      results.push({ test: 'Trading Configuration', status: 'running', message: 'Checking trading config...' });
      setTestResults([...results]);
      
      const { data: config } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (config && config.is_active) {
        results[2] = { test: 'Trading Configuration', status: 'success', message: '✅ Trading config active' };
      } else {
        results[2] = { test: 'Trading Configuration', status: 'error', message: '❌ Trading config not active' };
      }
      setTestResults([...results]);
      
      // Test 4: Test signal generation
      results.push({ test: 'Signal Generation', status: 'running', message: 'Testing signal generation...' });
      setTestResults([...results]);
      
      try {
        // Create a test signal
        const { data: signal, error: signalError } = await supabase
          .from('trading_signals')
          .insert({
            user_id: user.id,
            symbol: 'BTCUSDT',
            signal_type: 'buy',
            price: 50000,
            confidence: 0.8,
            reasoning: 'Test signal for system verification',
            processed: false,
          })
          .select()
          .single();
        
        if (signalError) {
          results[3] = { test: 'Signal Generation', status: 'error', message: `❌ Signal creation failed: ${signalError.message}` };
        } else {
          results[3] = { test: 'Signal Generation', status: 'success', message: '✅ Test signal created successfully' };
          
          // Clean up test signal
          await supabase
            .from('trading_signals')
            .delete()
            .eq('id', signal.id);
        }
      } catch (error) {
        results[3] = { test: 'Signal Generation', status: 'error', message: `❌ Signal test failed: ${error}` };
      }
      setTestResults([...results]);
      
      // Test 5: Test order placement (mock)
      results.push({ test: 'Order Placement Test', status: 'running', message: 'Testing order placement...' });
      setTestResults([...results]);
      
      try {
        const { data: testOrder, error: orderError } = await supabase.functions.invoke('bybit-api', {
          body: {
            endpoint: '/v5/order/create',
            method: 'POST',
            params: {
              category: 'spot',
              symbol: 'BTCUSDT',
              side: 'Buy',
              orderType: 'Limit',
              qty: '0.001',
              price: '40000',
              timeInForce: 'GTC'
            },
            isDemoTrading: true
          }
        });
        
        if (orderError) {
          results[4] = { test: 'Order Placement Test', status: 'error', message: `❌ Order test failed: ${orderError.message}` };
        } else if (testOrder?.retCode === 0) {
          results[4] = { test: 'Order Placement Test', status: 'success', message: '✅ Order placement working' };
        } else {
          results[4] = { test: 'Order Placement Test', status: 'warning', message: `⚠️ Order response: ${testOrder?.retMsg}` };
        }
      } catch (error) {
        results[4] = { test: 'Order Placement Test', status: 'error', message: `❌ Order test error: ${error}` };
      }
      setTestResults([...results]);
      
      // Summary
      const successCount = results.filter(r => r.status === 'success').length;
      const totalTests = results.length;
      
      if (successCount === totalTests) {
        toast({
          title: "System Test Complete",
          description: `All ${totalTests} tests passed! Trading system is ready.`,
        });
      } else {
        toast({
          title: "System Test Complete",
          description: `${successCount}/${totalTests} tests passed. Check results for issues.`,
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: "Test Error",
        description: "Failed to complete system tests.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return {
    isTesting,
    testResults,
    runSystemTests
  };
};
