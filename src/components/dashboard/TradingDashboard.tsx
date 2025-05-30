
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Settings, TrendingUp, DollarSign, Activity, BarChart3 } from 'lucide-react';
import TradingConfig from '@/components/trading/TradingConfig';
import TradeHistory from '@/components/trading/TradeHistory';
import TradingLogs from '@/components/trading/TradingLogs';
import { useToast } from '@/hooks/use-toast';

interface TradingStats {
  totalTrades: number;
  activePairs: number;
  totalProfit: number;
  isActive: boolean;
}

const TradingDashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<TradingStats>({
    totalTrades: 0,
    activePairs: 0,
    totalProfit: 0,
    isActive: false
  });

  useEffect(() => {
    if (user) {
      fetchTradingStats();
    }
  }, [user]);

  const fetchTradingStats = async () => {
    if (!user) return;

    try {
      // Get trading config
      const { data: config } = await supabase
        .from('trading_configs')
        .select('is_active')
        .eq('user_id', user.id)
        .single();

      // Get total trades
      const { count: totalTrades } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get total profit/loss
      const { data: profitData } = await supabase
        .from('trades')
        .select('profit_loss')
        .eq('user_id', user.id)
        .eq('status', 'filled');

      const totalProfit = profitData?.reduce((sum, trade) => 
        sum + (parseFloat(trade.profit_loss || '0')), 0) || 0;

      // Get active pairs (unique symbols with pending orders)
      const { data: activePairsData } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      const activePairs = new Set(activePairsData?.map(trade => trade.symbol)).size;

      setStats({
        totalTrades: totalTrades || 0,
        activePairs,
        totalProfit,
        isActive: config?.is_active || false
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Crypto Trading Bot</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {user?.email}</span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={stats.isActive ? "default" : "secondary"}>
                {stats.isActive ? "Active" : "Inactive"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTrades}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Pairs</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activePairs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${stats.totalProfit.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="config" className="space-y-6">
          <TabsList>
            <TabsTrigger value="config">
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="trades">
              <BarChart3 className="h-4 w-4 mr-2" />
              Trade History
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Activity className="h-4 w-4 mr-2" />
              System Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config">
            <TradingConfig onConfigUpdate={fetchTradingStats} />
          </TabsContent>

          <TabsContent value="trades">
            <TradeHistory />
          </TabsContent>

          <TabsContent value="logs">
            <TradingLogs />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TradingDashboard;
