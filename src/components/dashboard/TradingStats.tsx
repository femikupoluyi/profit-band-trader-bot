import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, BarChart3, TrendingUp, DollarSign, Calendar, Target, Volume, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TradingStatsProps {
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

const TradingStats = ({ stats, isLoading, timeRange, onTimeRangeChange }: TradingStatsProps) => {
  // Debug: Log the stats being received
  console.log('🔍 TradingStats received stats:', stats);
  console.log('🔍 TradingStats isLoading:', isLoading);
  
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrom = new Date(e.target.value);
    onTimeRangeChange({ from: newFrom, to: timeRange.to });
  };

  const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTo = new Date(e.target.value);
    onTimeRangeChange({ from: timeRange.from, to: newTo });
  };

  const setQuickRange = (days: number) => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - days);
    onTimeRangeChange({ from, to: now });
  };

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Time Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="space-y-2">
                <Label htmlFor="from-date">From</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={formatDate(timeRange.from)}
                  onChange={handleFromDateChange}
                  className="w-full sm:w-auto"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to-date">To</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={formatDate(timeRange.to)}
                  onChange={handleToDateChange}
                  className="w-full sm:w-auto"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setQuickRange(1)}>
                1D
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange(7)}>
                7D
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange(30)}>
                30D
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange(90)}>
                90D
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trading Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Active</CardTitle>
            <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
            ) : (
              <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.totalActive}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Closed</CardTitle>
            <Target className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
            ) : (
              <div className="text-xl sm:text-2xl font-bold">{stats.totalClosed}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Profitable Closed</CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
            ) : (
              <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.totalProfitableClosed}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Volume</CardTitle>
            <Volume className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
            ) : (
              <div className="text-lg sm:text-xl font-bold">
                ${stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Profit Performance and Closed P&L Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profit Performance Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Profit Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse bg-gray-200 h-12 w-32 rounded"></div>
            ) : (
              <div className="flex items-center gap-4">
                <div className={`text-3xl font-bold ${stats.profitPercentage >= 50 ? 'text-green-600' : stats.profitPercentage >= 25 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {stats.profitPercentage.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">
                  of closed trades were profitable ({stats.totalProfitableClosed}/{stats.totalClosed})
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Closed P&L Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Closed P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse bg-gray-200 h-12 w-32 rounded"></div>
            ) : (
              <div className="flex items-center gap-4">
                <div className={`text-3xl font-bold ${stats.closedPositionsProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${stats.closedPositionsProfit.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">
                  total profit from closed positions
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TradingStats;
