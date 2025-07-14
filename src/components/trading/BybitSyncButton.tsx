
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { BybitService } from '@/services/bybitService';
import { PositionSyncService } from '@/services/trading/core/PositionSyncService';
import { TradeSyncService } from '@/services/trading/tradeSyncService';

interface BybitSyncButtonProps {
  onSyncComplete?: () => void;
  timeRange?: { from: Date; to: Date };
}

const BybitSyncButton = ({ onSyncComplete, timeRange }: BybitSyncButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    
    try {
      console.log('🔄 CRITICAL: Starting comprehensive Bybit sync...');
      
      toast({
        title: "Sync Started",
        description: "Synchronizing with Bybit exchange...",
      });

      // Get credentials from CredentialsManager
      console.log('🔑 CRITICAL: Getting credentials...');
      const { CredentialsManager } = await import('@/services/trading/credentialsManager');
      const credentialsManager = new CredentialsManager(user.id);
      const bybitService = await credentialsManager.fetchCredentials();

      if (!bybitService) {
        console.error('❌ CRITICAL: Failed to get Bybit credentials');
        throw new Error('Failed to get Bybit credentials');
      }

      console.log('🔑 CRITICAL: Bybit credentials retrieved successfully');

      // CRITICAL: Calculate lookback hours from time range
      const lookbackHours = timeRange ? 
        Math.ceil((timeRange.to.getTime() - timeRange.from.getTime()) / (1000 * 60 * 60)) : 
        72; // Default 72 hours if no range provided
      
      console.log(`🚨 CRITICAL: Running comprehensive sync for ${lookbackHours} hours (${timeRange?.from?.toDateString()} to ${timeRange?.to?.toDateString()})...`);
      
      // CRITICAL: First test active orders API directly
      console.log('🧪 CRITICAL: Testing active orders API directly...');
      const testActiveOrders = await bybitService.getActiveOrders(100);
      console.log('🧪 CRITICAL: Direct API test result:', testActiveOrders);
      console.log(`🧪 CRITICAL: Found ${testActiveOrders?.result?.list?.length || 0} active orders from direct API call`);
      
      // CRITICAL: First run the comprehensive sync to get missing orders
      console.log('📦 CRITICAL: Importing ComprehensiveTradeSync...');
      const { ComprehensiveTradeSync } = await import('@/services/trading/core/ComprehensiveTradeSync');
      const comprehensiveSync = new ComprehensiveTradeSync(user.id, bybitService);
      
      console.log(`🔍 CRITICAL: Starting emergency sync with lookback: ${lookbackHours} hours`);
      console.log(`🔍 CRITICAL: This should fetch your 88 open orders from Bybit...`);
      
      console.log('🚀 CRITICAL: Calling emergencyFullSyncWithTimeRange...');
      await comprehensiveSync.emergencyFullSyncWithTimeRange(lookbackHours);
      console.log('✅ CRITICAL: emergencyFullSyncWithTimeRange completed');

      const positionSyncService = new PositionSyncService(user.id, bybitService);
      const tradeSyncService = new TradeSyncService(user.id, bybitService);

      // Perform comprehensive sync
      console.log('📊 Syncing positions with exchange...');
      await positionSyncService.syncAllPositionsWithExchange();

      console.log('🔍 Syncing active trades...');
      await tradeSyncService.syncAllActiveTrades();

      console.log('🎯 Detecting closed positions...');
      await tradeSyncService.detectAndRecordClosedPositions();

      // Also run comprehensive closed position detection
      console.log('🔍 Running comprehensive closed position detection...');
      const { ClosedPositionDetector } = await import('@/services/trading/core/ClosedPositionDetector');
      const closedPositionDetector = new ClosedPositionDetector(user.id, bybitService);
      await closedPositionDetector.detectAndMarkClosedPositions();
      await closedPositionDetector.detectClosedPositionsByBalance();

      // CRITICAL: Clean up stale data
      console.log('🧹 Running stale data cleanup...');
      const { StaleDataCleanupService } = await import('@/services/trading/core/StaleDataCleanupService');
      const cleanupService = new StaleDataCleanupService(user.id);
      await cleanupService.cleanupStaleData();

      console.log('✅ Sync completed successfully');

      toast({
        title: "Sync Complete",
        description: "Successfully synchronized with Bybit exchange",
      });

      // Notify parent component
      if (onSyncComplete) {
        onSyncComplete();
      }

    } catch (error) {
      console.error('❌ Sync failed:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to synchronize with Bybit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={isSyncing}
      className="flex items-center gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
      {isSyncing ? 'Syncing...' : 'Sync from Bybit'}
    </Button>
  );
};

export default BybitSyncButton;
