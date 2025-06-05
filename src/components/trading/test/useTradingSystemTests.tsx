
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { TestResult } from './types';
import { TestRunner } from './testRunner';
import { TRADING_ENVIRONMENT } from '@/services/trading/core/TypeDefinitions';

export const useTradingSystemTests = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const runSystemTests = async () => {
    if (!user) return;
    
    setIsTesting(true);
    setTestResults([]);
    
    try {
      const testRunner = new TestRunner(user.id, setTestResults);
      const results = await testRunner.runAllTests();
      
      // Summary
      const successCount = results.filter(r => r.status === 'success').length;
      const totalTests = results.length;
      
      if (successCount === totalTests) {
        toast({
          title: "System Test Complete",
          description: `All ${totalTests} tests passed! Bybit ${TRADING_ENVIRONMENT.isDemoTrading ? 'DEMO' : 'LIVE'} account trading system is ready.`,
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
