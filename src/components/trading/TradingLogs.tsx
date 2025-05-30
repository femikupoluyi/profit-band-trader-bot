
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { AlertCircle, Info, AlertTriangle, TrendingUp, Search } from 'lucide-react';

interface TradingLog {
  id: string;
  log_type: string;
  message: string;
  data?: any;
  created_at: string;
}

const TradingLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<TradingLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchLogs();
      
      // Set up real-time subscription for new logs
      const subscription = supabase
        .channel('trading_logs')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'trading_logs',
            filter: `user_id=eq.${user.id}`
          }, 
          (payload) => {
            setLogs(prev => [payload.new as TradingLog, ...prev]);
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchLogs = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('trading_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLogIcon = (logType: string) => {
    switch (logType) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'trade':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'scan':
        return <Search className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLogBadge = (logType: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      error: "destructive",
      warning: "outline",
      trade: "default",
      scan: "secondary",
      info: "secondary",
    };
    return <Badge variant={variants[logType] || "secondary"}>{logType}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Logs</CardTitle>
          <CardDescription>Loading system activity logs...</CardDescription>
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
        <CardTitle>System Logs</CardTitle>
        <CardDescription>
          Monitor your trading bot's activity and system events in real-time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No logs found. System activity will appear here once your bot starts running.
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 mt-0.5">
                  {getLogIcon(log.log_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div>{getLogBadge(log.log_type)}</div>
                    <span className="text-xs text-gray-500">
                      {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900">{log.message}</p>
                  {log.data && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                        View Details
                      </summary>
                      <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-x-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradingLogs;
