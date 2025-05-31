
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTradingStats } from '@/hooks/useTradingStats';
import DashboardHeader from './DashboardHeader';
import TradingStats from './TradingStats';
import DashboardTabs from './DashboardTabs';

const TradingDashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { stats, isLoading, refetch } = useTradingStats(user?.id);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader userEmail={user?.email} onSignOut={handleSignOut} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <TradingStats stats={stats} isLoading={isLoading} />
        <DashboardTabs onConfigUpdate={refetch} />
      </div>
    </div>
  );
};

export default TradingDashboard;
