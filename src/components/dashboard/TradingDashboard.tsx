
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Settings, TrendingUp, DollarSign, Activity, BarChart3, Key, Menu } from 'lucide-react';
import TradingConfig from '@/components/trading/TradingConfig';
import TradeHistory from '@/components/trading/TradeHistory';
import TradingLogs from '@/components/trading/TradingLogs';
import ApiCredentials from '@/components/trading/ApiCredentials';
import TradingStatus from '@/components/trading/TradingStatus';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTradingStats();
    }
  }, [user]);

  const fetchTradingStats = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      console.log('Fetching trading stats for user:', user.id);

      // Get trading config with proper error handling
      const { data: config, error: configError } = await supabase
        .from('trading_configs')
        .select('is_active')
        .eq('user_id', user.id)
        .maybeSingle();

      if (configError) {
        console.error('Error fetching config:', configError);
      }

      // Get total trades count
      const { count: totalTrades, error: tradesCountError } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (tradesCountError) {
        console.error('Error fetching trades count:', tradesCountError);
      }

      // Get completed trades for profit calculation
      const { data: completedTrades, error: profitError } = await supabase
        .from('trades')
        .select('profit_loss, price, quantity, side')
        .eq('user_id', user.id)
        .in('status', ['filled', 'closed']);

      if (profitError) {
        console.error('Error fetching profit data:', profitError);
      }

      // Calculate total profit/loss more accurately
      let totalProfit = 0;
      if (completedTrades && completedTrades.length > 0) {
        totalProfit = completedTrades.reduce((sum, trade) => {
          const profitLoss = parseFloat(trade.profit_loss || '0');
          return sum + profitLoss;
        }, 0);
      }

      // Get active trading pairs (unique symbols with open positions)
      const { data: activeTrades, error: activeError } = await supabase
        .from('trades')
        .select('symbol')
        .eq('user_id', user.id)
        .in('status', ['pending', 'filled'])
        .eq('side', 'buy'); // Only count buy positions as active pairs

      if (activeError) {
        console.error('Error fetching active trades:', activeError);
      }

      const activePairs = activeTrades ? new Set(activeTrades.map(trade => trade.symbol)).size : 0;

      const newStats = {
        totalTrades: totalTrades || 0,
        activePairs,
        totalProfit,
        isActive: config?.is_active || false
      };

      console.log('Updated stats:', newStats);
      setStats(newStats);
    } catch (error) {
      console.error('Error fetching trading stats:', error);
      toast({
        title: "Error",
        description: "Failed to fetch trading statistics.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
  };

  const MobileMenu = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="md:hidden">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px]">
        <div className="flex flex-col space-y-4 mt-4">
          <h2 className="text-lg font-semibold">Navigation</h2>
          <div className="flex flex-col space-y-2">
            <Button variant="ghost" className="justify-start">
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </Button>
            <Button variant="ghost" className="justify-start">
              <Key className="h-4 w-4 mr-2" />
              API Setup
            </Button>
            <Button variant="ghost" className="justify-start">
              <Activity className="h-4 w-4 mr-2" />
              Trading Status
            </Button>
            <Button variant="ghost" className="justify-start">
              <BarChart3 className="h-4 w-4 mr-2" />
              Trade History
            </Button>
            <Button variant="ghost" className="justify-start">
              <Activity className="h-4 w-4 mr-2" />
              System Logs
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900 hidden sm:block">Crypto Trading Bot</h1>
              <h1 className="text-lg font-semibold text-gray-900 sm:hidden">Trading Bot</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-sm text-gray-700 hidden sm:inline">Welcome, {user?.email}</span>
              <MobileMenu />
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Stats Cards */}
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

        {/* Main Content */}
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
            <TradingConfig onConfigUpdate={fetchTradingStats} />
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
      </div>
    </div>
  );
};

export default TradingDashboard;
