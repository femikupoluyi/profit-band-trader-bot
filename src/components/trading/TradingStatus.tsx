
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, RotateCcw, Sunset, X, TestTube } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { tradingManager } from '@/services/tradingManager';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const TradingStatus = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulatingEOD, setIsSimulatingEOD] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (user) {
      checkTradingStatus();
    }
  }, [user]);

  const checkTradingStatus = () => {
    if (user) {
      const running = tradingManager.isRunningForUser(user.id);
      setIsRunning(running);
    }
  };

  const handleStart = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await tradingManager.startTradingForUser(user.id);
      setIsRunning(true);
      toast({
        title: "Trading Started",
        description: "Your trading bot is now active and monitoring markets.",
      });
    } catch (error) {
      console.error('Failed to start trading:', error);
      toast({
        title: "Failed to Start Trading",
        description: error instanceof Error ? error.message : "Please check your configuration and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await tradingManager.stopTradingForUser(user.id);
      setIsRunning(false);
      toast({
        title: "Trading Stopped",
        description: "Your trading bot has been stopped.",
      });
    } catch (error) {
      console.error('Failed to stop trading:', error);
      toast({
        title: "Failed to Stop Trading",
        description: "There was an error stopping the trading bot.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await tradingManager.restartTradingForUser(user.id);
      setIsRunning(true);
      toast({
        title: "Trading Restarted",
        description: "Your trading bot has been restarted with the latest configuration.",
      });
    } catch (error) {
      console.error('Failed to restart trading:', error);
      toast({
        title: "Failed to Restart Trading",
        description: error instanceof Error ? error.message : "Please check your configuration and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateEOD = async () => {
    if (!user) return;
    
    setIsSimulatingEOD(true);
    try {
      console.log('🌅 Starting manual EOD simulation...');
      await tradingManager.simulateEndOfDay(user.id);
      
      toast({
        title: "End-of-Day Simulation Complete",
        description: "Check the system logs for detailed results of the EOD simulation.",
      });
    } catch (error) {
      console.error('Failed to simulate EOD:', error);
      toast({
        title: "EOD Simulation Failed",
        description: error instanceof Error ? error.message : "Please check the system logs for details.",
        variant: "destructive",
      });
    } finally {
      setIsSimulatingEOD(false);
    }
  };

  const handleTestConnections = async () => {
    if (!user) return;
    
    setIsTesting(true);
    try {
      console.log('🧪 Testing trading system connections...');
      
      // Test API credentials
      const { data: credentials, error: credError } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (credError || !credentials) {
        throw new Error('API credentials not found');
      }

      // Test trading config
      const { data: config, error: configError } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (configError || !config) {
        throw new Error('Trading configuration not found');
      }

      // Test database connection by fetching some trades
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('count')
        .eq('user_id', user.id);

      if (tradesError) {
        throw new Error(`Database connection test failed: ${tradesError.message}`);
      }

      toast({
        title: "System Test Complete",
        description: "All connections and configurations are working properly.",
      });

    } catch (error) {
      console.error('System test failed:', error);
      toast({
        title: "System Test Failed",
        description: error instanceof Error ? error.message : "One or more system components failed testing.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Trading Bot Status
          <Badge variant={isRunning ? "default" : "secondary"}>
            {isRunning ? "ACTIVE" : "STOPPED"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Control your automated trading bot and monitor its status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {!isRunning ? (
            <Button 
              onClick={handleStart} 
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {isLoading ? "Starting..." : "Start Trading"}
            </Button>
          ) : (
            <Button 
              onClick={handleStop} 
              disabled={isLoading}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              {isLoading ? "Stopping..." : "Stop Trading"}
            </Button>
          )}
          
          <Button 
            onClick={handleRestart} 
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {isLoading ? "Restarting..." : "Restart"}
          </Button>

          <Button 
            onClick={handleSimulateEOD} 
            disabled={isSimulatingEOD}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Sunset className="h-4 w-4" />
            {isSimulatingEOD ? "Simulating..." : "Simulate EOD"}
          </Button>

          <Button 
            onClick={handleTestConnections} 
            disabled={isTesting}
            variant="outline"
            className="flex items-center gap-2"
          >
            <TestTube className="h-4 w-4" />
            {isTesting ? "Testing..." : "Test System"}
          </Button>
        </div>

        <div className="text-sm text-gray-600">
          <p><strong>Status:</strong> {isRunning ? "Bot is actively monitoring markets and executing trades" : "Bot is stopped - no trading activity"}</p>
          <p><strong>EOD Simulation:</strong> Forces end-of-day logic to run and close profitable positions</p>
          <p><strong>System Test:</strong> Verifies API credentials, database connection, and configuration</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TradingStatus;
