import React, { useState } from 'react';
import { SidebarProvider, SidebarTrigger, AppSidebar } from './SidebarNavigation';
import DashboardHeader from './DashboardHeader';
import TradingStats from './TradingStats';
import ActivePairsTable from './ActivePairsTable';
import ActiveTrades from './ActiveTrades';
import TradingStatus from '../trading/TradingStatus';
import TradingConfig from '../trading/TradingConfig';
import ApiCredentials from '../trading/ApiCredentials';
import TradeHistory from '../trading/TradeHistory';
import TradingLogs from '../trading/TradingLogs';
import TradesReport from '../trading/TradesReport';
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

  const navigationItems = [
    { id: 'status', title: 'Trading Status' },
    { id: 'trades', title: 'Trade History' },
    { id: 'reports', title: 'Reports' },
    { id: 'config', title: 'Configuration' },
    { id: 'logs', title: 'System Logs' },
    { id: 'api', title: 'API Setup' },
  ];

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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <TradingStatus />
              </div>
              <div>
                <ActiveTrades onTradeUpdate={handleDataRefresh} />
              </div>
            </div>
            <ActivePairsTable onTradeUpdate={handleDataRefresh} timeRange={timeRange} />
          </div>
        );
      case 'config':
        return <TradingConfig onConfigUpdate={refetch} />;
      case 'api':
        return <ApiCredentials />;
      case 'trades':
        return <TradeHistory />;
      case 'reports':
        return <TradesReport />;
      case 'logs':
        return <TradingLogs />;
      default:
        return (
          <div className="space-y-8">
            <TradingStats 
              stats={stats} 
              isLoading={isLoading} 
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <TradingStatus />
              </div>
              <div>
                <ActiveTrades onTradeUpdate={handleDataRefresh} />
              </div>
            </div>
            <ActivePairsTable onTradeUpdate={handleDataRefresh} timeRange={timeRange} />
          </div>
        );
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-100">
        <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 flex flex-col">
          <DashboardHeader userEmail={user?.email} onSignOut={handleSignOut} />
          <main className="flex-1 bg-gray-100">
            <div className="flex items-center gap-4 p-4 border-b bg-white shadow-sm">
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

export default DashboardWithSidebar;
