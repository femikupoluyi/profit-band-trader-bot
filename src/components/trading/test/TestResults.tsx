
import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { TestResult } from './types';

interface TestResultsProps {
  testResults: TestResult[];
}

const TestResults = ({ testResults }: TestResultsProps) => {
  if (testResults.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const successCount = testResults.filter(r => r.status === 'success').length;
  const errorCount = testResults.filter(r => r.status === 'error').length;
  const warningCount = testResults.filter(r => r.status === 'warning').length;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {testResults.map((result, index) => (
          <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
            {getStatusIcon(result.status)}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{result.test}</div>
              <div className={`text-xs ${getStatusColor(result.status)} whitespace-pre-wrap`}>
                {result.message}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-blue-50 rounded-lg text-sm">
        <strong>Test Summary:</strong>
        <div className="mt-1">
          ✅ Passed: {successCount} | 
          ⚠️ Warnings: {warningCount} | 
          ❌ Failed: {errorCount}
        </div>
      </div>
    </div>
  );
};

export default TestResults;
