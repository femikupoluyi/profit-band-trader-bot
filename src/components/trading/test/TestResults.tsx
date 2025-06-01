
import React from 'react';
import { TestResult } from './types';
import { TestStatusIcon } from './TestStatusIcon';

interface TestResultsProps {
  testResults: TestResult[];
}

export const TestResults: React.FC<TestResultsProps> = ({ testResults }) => {
  if (testResults.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Test Results:</h3>
      {testResults.map((result, index) => (
        <div key={index} className="flex items-center gap-2 p-2 border rounded">
          <TestStatusIcon status={result.status} />
          <span className="font-medium">{result.test}:</span>
          <span className="text-sm">{result.message}</span>
        </div>
      ))}
    </div>
  );
};
