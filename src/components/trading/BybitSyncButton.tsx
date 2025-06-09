
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
}

const BybitSyncButton = ({ onSyncComplete }: BybitSyncButtonProps) => {
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
      console.log('🔄 Starting comprehensive Bybit sync...');
      
      toast({
        title: "Sync Started",
        description: "Synchronizing with Bybit exchange...",
      });

      // Get credentials from CredentialsManager
      const { CredentialsManager } = await import('@/services/trading/credentialsManager');
      const credentialsManager = new CredentialsManager(user.id);
      const bybitService = await credentialsManager.fetchCredentials();

      if (!bybitService) {
        throw new Error('Failed to get Bybit credentials');
      }

      const positionSyncService = new PositionSyncService(user.id, bybitService);
      const tradeSyncService = new TradeSyncService(user.id, bybitService);

      // Perform comprehensive sync
      console.log('📊 Syncing positions with exchange...');
      await positionSyncService.syncAllPositionsWithExchange();

      console.log('🔍 Syncing active trades...');
      await tradeSyncService.syncAllActiveTrades();

      console.log('🎯 Detecting closed positions...');
      await tradeSyncService.detectAndRecordClosedPositions();

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
