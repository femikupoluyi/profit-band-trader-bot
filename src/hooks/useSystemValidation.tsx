
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { runTradingFlowTest, validatePLCalculationLogic } from '@/utils/tradingFlowSimulation';
import { ComprehensiveTestRunner } from '@/components/trading/test/comprehensiveTestRunner';
import { getRandomTestSymbol } from '@/components/trading/test/testConstants';

interface ValidationResult {
  test: string;
  status: 'success' | 'error' | 'warning' | 'running';
  message: string;
}

export const useSystemValidation = () => {
  const { user } = useAuth();
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);

  const runCompleteValidation = async () => {
    if (!user) return;

    setIsValidating(true);
    setValidationResults([]);

    try {
      console.log('🧪 Starting complete system validation...');

      // Test 1: P&L Calculation Logic
      setValidationResults(prev => [...prev, {
        test: 'P&L Calculation Logic',
        status: 'running',
        message: 'Validating P&L calculation scenarios...'
      }]);

      const plLogicResult = validatePLCalculationLogic();
      setValidationResults(prev => prev.map(r => 
        r.test === 'P&L Calculation Logic' 
          ? {
              ...r,
              status: plLogicResult ? 'success' : 'error',
              message: plLogicResult 
                ? '✅ All P&L calculation scenarios validated'
                : '❌ P&L calculation logic failed validation'
            }
          : r
      ));

      // Test 2: Trading Flow Simulation
      setValidationResults(prev => [...prev, {
        test: 'Complete Trading Flow',
        status: 'running',
        message: 'Testing buy → fill → price updates → reporting...'
      }]);

      const testSymbol = getRandomTestSymbol();
      const flowResult = await runTradingFlowTest(user.id, testSymbol);
      
      setValidationResults(prev => prev.map(r => 
        r.test === 'Complete Trading Flow' 
          ? {
              ...r,
              status: flowResult ? 'success' : 'error',
              message: flowResult 
                ? `✅ Complete trading flow validated for ${testSymbol}`
                : `❌ Trading flow validation failed for ${testSymbol}`
            }
          : r
      ));

      // Test 3: Comprehensive System Tests
      setValidationResults(prev => [...prev, {
        test: 'System Components',
        status: 'running',
        message: 'Running comprehensive component tests...'
      }]);

      const comprehensiveRunner = new ComprehensiveTestRunner(user.id);
      const comprehensiveResults = await comprehensiveRunner.runAllValidationTests();
      
      // Update the running test and add individual results
      setValidationResults(prev => {
        const filtered = prev.filter(r => r.test !== 'System Components');
        return [...filtered, ...comprehensiveResults];
      });

      console.log('✅ Complete system validation finished');

    } catch (error) {
      console.error('❌ System validation failed:', error);
      setValidationResults(prev => [...prev, {
        test: 'System Validation',
        status: 'error',
        message: `❌ Validation failed: ${error}`
      }]);
    } finally {
      setIsValidating(false);
    }
  };

  const clearResults = () => {
    setValidationResults([]);
  };

  const getValidationSummary = () => {
    const successCount = validationResults.filter(r => r.status === 'success').length;
    const errorCount = validationResults.filter(r => r.status === 'error').length;
    const warningCount = validationResults.filter(r => r.status === 'warning').length;
    const runningCount = validationResults.filter(r => r.status === 'running').length;

    return {
      total: validationResults.length,
      success: successCount,
      error: errorCount,
      warning: warningCount,
      running: runningCount,
      isComplete: runningCount === 0 && validationResults.length > 0
    };
  };

  return {
    isValidating,
    validationResults,
    runCompleteValidation,
    clearResults,
    getValidationSummary
  };
};
