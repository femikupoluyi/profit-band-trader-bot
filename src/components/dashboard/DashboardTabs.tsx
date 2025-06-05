import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import TradingStats from './TradingStats';
import TradingConfig from '@/components/trading/config/TradingConfig';
import ActiveTrades from './ActiveTrades';
import TradeHistory from './TradeHistory';
import TradingLogs from './TradingLogs';

import { User } from '@supabase/supabase-js';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import TradingLogicOverview from '../trading/TradingLogicOverview';

interface DashboardTabsProps {
  user: User | null;
  userConfig: TradingConfigData | null;
  stats: {
    totalTrades: number;
    activePairs: number;
    totalProfit: number;
    closedPositionsProfit: number;
    isActive: boolean;
    totalActive: number;
    totalClosed: number;
    totalProfitableClosed: number;
    totalVolume: number;
    profitPercentage: number;
  };
  isLoading: boolean;
  timeRange: { from: Date; to: Date };
  onTimeRangeChange: (range: { from: Date; to: Date }) => void;
}

const DashboardTabs = ({ user, userConfig, stats, isLoading, timeRange, onTimeRangeChange }: DashboardTabsProps) => {
  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="active-trades">Active Trades</TabsTrigger>
        <TabsTrigger value="config">Configuration</TabsTrigger>
        <TabsTrigger value="history">Trade History</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
        <TabsTrigger value="logic">Trading Logic</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <TradingStats
          stats={stats}
          isLoading={isLoading}
          timeRange={timeRange}
          onTimeRangeChange={onTimeRangeChange}
        />
      </TabsContent>

      <TabsContent value="active-trades" className="space-y-4">
        <ActiveTrades />
      </TabsContent>

      <TabsContent value="config" className="space-y-4">
        {user && <TradingConfig userId={user.id} initialConfig={userConfig} />}
      </TabsContent>

      <TabsContent value="history" className="space-y-4">
        <TradeHistory />
      </TabsContent>

      <TabsContent value="logs" className="space-y-4">
        <TradingLogs />
      </TabsContent>

      <TabsContent value="logic" className="space-y-4">
        <TradingLogicOverview />
      </TabsContent>
    </Tabs>
  );
};

export default DashboardTabs;
