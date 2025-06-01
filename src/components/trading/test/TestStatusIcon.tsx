
import React from 'react';
import { CheckCircle, XCircle, Loader2, TestTube } from 'lucide-react';

interface TestStatusIconProps {
  status: string;
}

export const TestStatusIcon: React.FC<TestStatusIconProps> = ({ status }) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    default:
      return <TestTube className="h-4 w-4 text-gray-500" />;
  }
};
