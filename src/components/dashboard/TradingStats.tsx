
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, BarChart3, TrendingUp, DollarSign } from 'lucide-react';

interface TradingStatsProps {
  stats: {
    totalTrades: number;
    activePairs: number;
    totalProfit: number;
    isActive: boolean;
  };
  isLoading: boolean;
}

const TradingStats = ({ stats, isLoading }: TradingStatsProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Bot Status</CardTitle>
          <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
          ) : (
            <Badge variant={stats.isActive ? "default" : "secondary"} className="text-xs">
              {stats.isActive ? "Active" : "Inactive"}
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Total Trades</CardTitle>
          <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
          ) : (
            <div className="text-xl sm:text-2xl font-bold">{stats.totalTrades}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Active Pairs</CardTitle>
          <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
          ) : (
            <div className="text-xl sm:text-2xl font-bold">{stats.activePairs}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Total P&L</CardTitle>
          <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
          ) : (
            <div className={`text-lg sm:text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${stats.totalProfit.toFixed(2)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TradingStats;
