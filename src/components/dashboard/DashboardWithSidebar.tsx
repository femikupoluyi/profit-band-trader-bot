
import React, { useState } from 'react';
import { SidebarProvider, SidebarTrigger, AppSidebar } from './SidebarNavigation';
import DashboardHeader from './DashboardHeader';
import TradingStats from './TradingStats';
import ActivePairsTable from './ActivePairsTable';
import DashboardTabs from './DashboardTabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTradingStats } from '@/hooks/useTradingStats';

const DashboardWithSidebar = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { stats, isLoading, timeRange, setTimeRange, refetch } = useTradingStats(user?.id);
  const [activeTab, setActiveTab] = useState('status');

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
  };

  const handleDataRefresh = () => {
    refetch();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'status':
        return (
          <div className="space-y-8">
            <TradingStats 
              stats={stats} 
              isLoading={isLoading} 
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />
            <ActivePairsTable onTradeUpdate={handleDataRefresh} />
          </div>
        );
      case 'config':
      case 'api':
      case 'trades':
      case 'reports':
      case 'logs':
        return <DashboardTabs onConfigUpdate={refetch} />;
      default:
        return (
          <div className="space-y-8">
            <TradingStats 
              stats={stats} 
              isLoading={isLoading} 
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />
            <ActivePairsTable onTradeUpdate={handleDataRefresh} />
          </div>
        );
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 flex flex-col">
          <DashboardHeader userEmail={user?.email} onSignOut={handleSignOut} />
          <main className="flex-1 bg-gray-50">
            <div className="flex items-center gap-4 p-4 border-b bg-white">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold text-gray-900">
                {navigationItems.find(item => item.id === activeTab)?.title || 'Trading Dashboard'}
              </h2>
            </div>
            <div className="p-4 sm:p-6 lg:p-8">
              {renderTabContent()}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

const navigationItems = [
  { id: 'config', title: 'Configuration' },
  { id: 'api', title: 'API Setup' },
  { id: 'status', title: 'Trading Status' },
  { id: 'trades', title: 'Trade History' },
  { id: 'reports', title: 'Reports' },
  { id: 'logs', title: 'System Logs' },
];

export default DashboardWithSidebar;
