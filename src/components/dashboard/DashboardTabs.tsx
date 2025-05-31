
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Key, Activity, BarChart3 } from 'lucide-react';
import TradingConfig from '@/components/trading/TradingConfig';
import TradeHistory from '@/components/trading/TradeHistory';
import TradingLogs from '@/components/trading/TradingLogs';
import ApiCredentials from '@/components/trading/ApiCredentials';
import TradingStatus from '@/components/trading/TradingStatus';

interface DashboardTabsProps {
  onConfigUpdate: () => void;
}

const DashboardTabs = ({ onConfigUpdate }: DashboardTabsProps) => {
  return (
    <Tabs defaultValue="config" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto">
        <TabsTrigger value="config" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 p-2 sm:p-3">
          <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="text-xs sm:text-sm">Config</span>
        </TabsTrigger>
        <TabsTrigger value="api" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 p-2 sm:p-3">
          <Key className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="text-xs sm:text-sm">API</span>
        </TabsTrigger>
        <TabsTrigger value="status" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 p-2 sm:p-3">
          <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="text-xs sm:text-sm">Status</span>
        </TabsTrigger>
        <TabsTrigger value="trades" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 p-2 sm:p-3">
          <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="text-xs sm:text-sm">Trades</span>
        </TabsTrigger>
        <TabsTrigger value="logs" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 p-2 sm:p-3">
          <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="text-xs sm:text-sm">Logs</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="config">
        <TradingConfig onConfigUpdate={onConfigUpdate} />
      </TabsContent>

      <TabsContent value="api">
        <ApiCredentials />
      </TabsContent>

      <TabsContent value="status">
        <TradingStatus />
      </TabsContent>

      <TabsContent value="trades">
        <TradeHistory />
      </TabsContent>

      <TabsContent value="logs">
        <TradingLogs />
      </TabsContent>
    </Tabs>
  );
};

export default DashboardTabs;
