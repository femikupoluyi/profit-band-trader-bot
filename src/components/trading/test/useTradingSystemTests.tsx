
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
      results.push({ test: 'API Credentials', status: 'running', message: 'Checking Bybit MAIN exchange API credentials...' });
      setTestResults([...results]);
      
      const { data: credentials, error: credError } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange_name', 'bybit')
        .eq('is_active', true)
        .maybeSingle();
      
      if (credError) {
        results[0] = { test: 'API Credentials', status: 'error', message: `❌ Error fetching credentials: ${credError.message}` };
      } else if (credentials && credentials.api_key && credentials.api_secret) {
        results[0] = { test: 'API Credentials', status: 'success', message: '✅ Bybit MAIN exchange API credentials found and active' };
      } else {
        results[0] = { test: 'API Credentials', status: 'error', message: '❌ Bybit MAIN exchange API credentials not found. Please configure them in the API Setup tab.' };
      }
      setTestResults([...results]);
      
      // Test 2: Test Bybit MAIN API connection
      results.push({ test: 'Bybit MAIN API', status: 'running', message: 'Testing Bybit MAIN exchange API connection...' });
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
            isDemoTrading: false // MAIN exchange
          }
        });
        
        if (apiError) {
          results[1] = { test: 'Bybit MAIN API', status: 'error', message: `❌ API Error: ${apiError.message}` };
        } else if (apiResponse?.retCode === 0) {
          const price = apiResponse.result?.list?.[0]?.lastPrice;
          results[1] = { test: 'Bybit MAIN API', status: 'success', message: `✅ Bybit MAIN exchange API working! BTC: $${price}` };
        } else {
          results[1] = { test: 'Bybit MAIN API', status: 'error', message: `❌ API returned error: ${apiResponse?.retMsg}` };
        }
      } catch (error) {
        results[1] = { test: 'Bybit MAIN API', status: 'error', message: `❌ Connection failed: ${error}` };
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
      
      // Test 5: Test account balance check with proper error handling
      results.push({ test: 'Account Balance Check', status: 'running', message: 'Testing account balance access on Bybit MAIN exchange...' });
      setTestResults([...results]);
      
      try {
        const { data: balanceResponse, error: balanceError } = await supabase.functions.invoke('bybit-api', {
          body: {
            endpoint: '/v5/account/wallet-balance',
            method: 'GET',
            params: {
              accountType: 'UNIFIED'
            },
            isDemoTrading: false // MAIN exchange
          }
        });
        
        if (balanceError) {
          results[4] = { test: 'Account Balance Check', status: 'error', message: `❌ Balance check failed: ${balanceError.message}` };
        } else if (balanceResponse?.retCode === 0) {
          results[4] = { test: 'Account Balance Check', status: 'success', message: '✅ Account balance access working on MAIN exchange' };
        } else if (balanceResponse?.retCode === 10001) {
          results[4] = { test: 'Account Balance Check', status: 'error', message: '❌ API signature error - check your API credentials setup' };
        } else if (balanceResponse?.retCode === 10003) {
          results[4] = { test: 'Account Balance Check', status: 'warning', message: '⚠️ API credentials may need trading permissions enabled' };
        } else {
          results[4] = { test: 'Account Balance Check', status: 'warning', message: `⚠️ Balance response: ${balanceResponse?.retMsg}` };
        }
      } catch (error) {
        results[4] = { test: 'Account Balance Check', status: 'error', message: `❌ Balance check error: ${error}` };
      }
      setTestResults([...results]);
      
      // Summary
      const successCount = results.filter(r => r.status === 'success').length;
      const totalTests = results.length;
      
      if (successCount === totalTests) {
        toast({
          title: "System Test Complete",
          description: `All ${totalTests} tests passed! Bybit MAIN exchange trading system is ready.`,
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
