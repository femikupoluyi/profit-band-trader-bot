import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

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
      console.log('🔄 Starting Bybit sync...');
      
      toast({
        title: "Sync Started",
        description: "Synchronizing with Bybit exchange...",
      });

      // Get credentials and initialize sync
      const { CredentialsManager } = await import('@/services/trading/credentialsManager');
      const credentialsManager = new CredentialsManager(user.id);
      const bybitService = await credentialsManager.fetchCredentials();

      if (!bybitService) {
        throw new Error('Failed to get Bybit credentials');
      }

      // Calculate lookback period
      const lookbackHours = timeRange ? 
        Math.ceil((timeRange.to.getTime() - timeRange.from.getTime()) / (1000 * 60 * 60)) : 
        72;
      
      console.log(`🔄 Syncing ${lookbackHours} hours of data...`);
      
      // Run comprehensive sync
      const { ComprehensiveTradeSync } = await import('@/services/trading/core/ComprehensiveTradeSync');
      const comprehensiveSync = new ComprehensiveTradeSync(user.id, bybitService);
      await comprehensiveSync.emergencyFullSyncWithTimeRange(lookbackHours);

      console.log('✅ Sync completed successfully');

      toast({
        title: "Sync Complete",
        description: "Successfully synchronized with Bybit exchange",
      });

      onSyncComplete?.();

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