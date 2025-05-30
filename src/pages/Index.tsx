
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import AuthPage from '@/components/auth/AuthPage';
import TradingDashboard from '@/components/dashboard/TradingDashboard';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <TradingDashboard />;
};

export default Index;
