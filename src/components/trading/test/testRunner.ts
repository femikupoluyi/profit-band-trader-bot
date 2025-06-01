
import { TestResult } from './types';
import { runApiCredentialsTest } from './apiCredentialsTest';
import { runBybitApiTest } from './bybitApiTest';
import { runTradingConfigTest } from './tradingConfigTest';
import { runSignalGenerationTest } from './signalGenerationTest';
import { runAccountBalanceTest } from './accountBalanceTest';
import { runMarketOrderTest } from './marketOrderTest';
import { runOrderStatusTest } from './orderStatusTest';

export class TestRunner {
  private userId: string;
  private onResultUpdate: (results: TestResult[]) => void;

  constructor(userId: string, onResultUpdate: (results: TestResult[]) => void) {
    this.userId = userId;
    this.onResultUpdate = onResultUpdate;
  }

  async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test 1: API Credentials
    results.push({ test: 'API Credentials', status: 'running', message: 'Checking Bybit DEMO account API credentials...' });
    this.onResultUpdate([...results]);
    
    const credentialsResult = await runApiCredentialsTest(this.userId);
    results[0] = credentialsResult;
    this.onResultUpdate([...results]);

    // Test 2: Bybit DEMO API
    results.push({ test: 'Bybit DEMO API', status: 'running', message: 'Testing Bybit DEMO account API connection...' });
    this.onResultUpdate([...results]);
    
    const apiResult = await runBybitApiTest();
    results[1] = apiResult;
    this.onResultUpdate([...results]);

    // Test 3: Trading Configuration
    results.push({ test: 'Trading Configuration', status: 'running', message: 'Checking trading config...' });
    this.onResultUpdate([...results]);
    
    const configResult = await runTradingConfigTest(this.userId);
    results[2] = configResult;
    this.onResultUpdate([...results]);

    // Test 4: Signal Generation
    results.push({ test: 'Signal Generation', status: 'running', message: 'Testing signal generation...' });
    this.onResultUpdate([...results]);
    
    const signalResult = await runSignalGenerationTest(this.userId);
    results[3] = signalResult;
    this.onResultUpdate([...results]);

    // Test 5: Account Balance Check
    results.push({ test: 'Account Balance Check', status: 'running', message: 'Testing account balance access on Bybit DEMO account...' });
    this.onResultUpdate([...results]);
    
    const balanceResult = await runAccountBalanceTest();
    results[4] = balanceResult;
    this.onResultUpdate([...results]);

    // Test 6: Market Order Test
    results.push({ test: 'Market Order Tests ($100-$1000)', status: 'running', message: 'Testing market order placement with SOL on DEMO account...' });
    this.onResultUpdate([...results]);
    
    const orderResult = await runMarketOrderTest();
    results[5] = orderResult;
    this.onResultUpdate([...results]);

    // Test 7: Order Status Check (only if order was successfully placed)
    if (orderResult.status === 'success' && (orderResult as any).orderId) {
      results.push({ test: 'Order Status Check', status: 'running', message: 'Checking order placement status...' });
      this.onResultUpdate([...results]);
      
      const statusResult = await runOrderStatusTest((orderResult as any).orderId);
      results[6] = statusResult;
      this.onResultUpdate([...results]);
    }

    return results;
  }
}
