
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { RefreshCw, Trash2, Database } from 'lucide-react';
import { InstrumentCache } from '@/services/trading/core/InstrumentCache';
import { ConfigurableFormatter } from '@/services/trading/core/ConfigurableFormatter';

interface TradingLog {
  id: string;
  log_type: string;
  message: string;
  data: any;
  created_at: string;
}

const TradingLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<TradingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user]);

  // Auto-refresh every 10 seconds when enabled
  useEffect(() => {
    if (!autoRefresh || !user) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, user]);

  const fetchLogs = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('trading_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching logs:', error);
        throw error;
      }

      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = async () => {
    if (!user) return;
    
    setClearing(true);
    try {
      console.log('🧹 Clearing all historical data and logs...');
      
      // Clear market data
      const { error: marketError } = await (supabase as any)
        .from('market_data')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (marketError) {
        console.error('Error clearing market data:', marketError);
      } else {
        console.log('✅ Market data cleared');
      }
      
      // Clear trade data
      const { error: tradesError } = await (supabase as any)
        .from('trades')
        .delete()
        .eq('user_id', user.id);
      
      if (tradesError) {
        console.error('Error clearing trades:', tradesError);
      } else {
        console.log('✅ Trade data cleared');
      }
      
      // Clear trading logs
      const { error: logsError } = await (supabase as any)
        .from('trading_logs')
        .delete()
        .eq('user_id', user.id);
      
      if (logsError) {
        console.error('Error clearing logs:', logsError);
      } else {
        console.log('✅ Trading logs cleared');
      }
      
      // Clear trading signals
      const { error: signalsError } = await (supabase as any)
        .from('trading_signals')
        .delete()
        .eq('user_id', user.id);
      
      if (signalsError) {
        console.error('Error clearing signals:', signalsError);
      } else {
        console.log('✅ Trading signals cleared');
      }
      
      // Refresh the logs display
      await fetchLogs();
      
      console.log('✅ All historical data including trades cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing data:', error);
    } finally {
      setClearing(false);
    }
  };

  const clearLogsOnly = async () => {
    if (!user) return;
    
    setClearingLogs(true);
    try {
      console.log('🧹 Starting to clear trading logs for user:', user.id);
      
      // Clear only trading logs for current user
      const { error: logsError } = await (supabase as any)
        .from('trading_logs')
        .delete()
        .eq('user_id', user.id);
      
      if (logsError) {
        console.error('❌ Error clearing logs:', logsError);
        throw logsError;
      } else {
        console.log('✅ Trading logs cleared successfully');
      }
      
      // Refresh the logs display
      await fetchLogs();
      
      console.log('✅ Trading logs operation completed');
    } catch (error) {
      console.error('❌ Error clearing logs:', error);
    } finally {
      setClearingLogs(false);
    }
  };

  const clearTradingCache = async () => {
    setClearingCache(true);
    try {
      console.log('🧹 Clearing all trading transaction cache data...');
      
      // Clear all trading caches
      InstrumentCache.clearAllTradingCache();
      ConfigurableFormatter.clearAllTradingCache();
      
      // Clear any browser storage cache
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('trading_cache');
          sessionStorage.removeItem('trading_cache');
          console.log('✅ Browser storage cache cleared');
        } catch (error) {
          console.warn('Could not clear browser storage:', error);
        }
      }
      
      console.log('✅ All trading transaction cache data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing cache data:', error);
    } finally {
      setClearingCache(false);
    }
  };

  const getLogTypeBadge = (logType: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      signal_processed: "default",
      trade_executed: "outline",
      trade_filled: "outline", 
      position_closed: "secondary",
      system_error: "destructive",
      order_placed: "outline",
      order_failed: "destructive",
      calculation_error: "destructive",
      execution_error: "destructive",
      signal_rejected: "secondary",
      order_rejected: "secondary"
    };
    return <Badge variant={variants[logType] || "outline"}>{logType.toUpperCase().replace('_', ' ')}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Logs</CardTitle>
          <CardDescription>Loading system activity...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>System Logs</CardTitle>
            <CardDescription>
              Monitor your trading bot's activity and system events.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearTradingCache}
              disabled={clearingCache}
            >
              <Database className="h-4 w-4 mr-2" />
              {clearingCache ? 'Clearing...' : 'Clear Cache'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearLogsOnly}
              disabled={clearingLogs}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {clearingLogs ? 'Clearing...' : 'Clear Logs'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllData}
              disabled={clearing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {clearing ? 'Clearing...' : 'Clear All Data & Trades'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No logs found. System activity will appear here as your bot operates.
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getLogTypeBadge(log.log_type)}
                    <span className="text-sm text-gray-500">
                      {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                    </span>
                  </div>
                </div>
                <p className="text-sm">{log.message}</p>
                {log.data && (
                  <details className="text-xs text-gray-600">
                    <summary className="cursor-pointer">Additional Data</summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradingLogs;
