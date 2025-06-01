
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, TestTube } from 'lucide-react';
import { useTradingSystemTests } from './test/useTradingSystemTests';
import { TestResults } from './test/TestResults';
import { TestInfo } from './test/TestInfo';

const TradingSystemTest = () => {
  const { user } = useAuth();
  const { isTesting, testResults, runSystemTests } = useTradingSystemTests();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Trading System Test
        </CardTitle>
        <CardDescription>
          Test all components of the trading system to ensure everything is working properly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runSystemTests} 
          disabled={isTesting || !user}
          className="w-full"
        >
          {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Run System Tests
        </Button>

        <TestResults testResults={testResults} />
        <TestInfo />
      </CardContent>
    </Card>
  );
};

export default TradingSystemTest;
