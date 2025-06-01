
import React from 'react';

export const TestInfo: React.FC = () => {
  return (
    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
      <strong>What this tests:</strong>
      <ul className="mt-1 space-y-1">
        <li>• API credentials configuration</li>
        <li>• Bybit Demo API connectivity</li>
        <li>• Trading configuration status</li>
        <li>• Signal generation system</li>
        <li>• Order placement functionality</li>
      </ul>
    </div>
  );
};
