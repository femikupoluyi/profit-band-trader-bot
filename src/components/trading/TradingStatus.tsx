
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { tradingManager } from '@/services/tradingManager';
import { Play, Square, RotateCcw, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TradingStatus = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkTradingStatus();
      // Check status every 10 seconds to reflect actual state
      const interval = setInterval(checkTradingStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const checkTradingStatus = () => {
    if (user) {
      setIsRunning(tradingManager.isRunningForUser(user.id));
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
      toast({
        title: "Error",
        description: "Failed to start trading bot.",
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
        description: "Your trading bot has been stopped and will not auto-restart.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop trading bot.",
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
        description: "Your trading bot has been restarted with updated configuration.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to restart trading bot.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Trading Engine Status
        </CardTitle>
        <CardDescription>
          Monitor and control your automated trading bot
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Engine Status:</span>
          <Badge variant={isRunning ? "default" : "secondary"}>
            {isRunning ? "Running" : "Stopped"}
          </Badge>
        </div>

        <div className="flex gap-2">
          {!isRunning ? (
            <Button 
              onClick={handleStart} 
              disabled={isLoading}
              className="flex-1"
            >
              <Play className="mr-2 h-4 w-4" />
              Start Trading
            </Button>
          ) : (
            <Button 
              onClick={handleStop} 
              disabled={isLoading}
              variant="destructive"
              className="flex-1"
            >
              <Square className="mr-2 h-4 w-4" />
              Stop Trading
            </Button>
          )}
          
          <Button 
            onClick={handleRestart} 
            disabled={isLoading}
            variant="outline"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Restart
          </Button>
        </div>

        {isRunning && (
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">
            ✅ Trading bot is actively monitoring markets and executing trades based on your configuration.
          </div>
        )}

        {!isRunning && (
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            ⏸️ Trading bot is stopped and will not auto-restart until manually started.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradingStatus;
