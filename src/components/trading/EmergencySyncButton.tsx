import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface EmergencySyncButtonProps {
  onSyncComplete?: () => void;
}

const EmergencySyncButton = ({ onSyncComplete }: EmergencySyncButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleEmergencySync = async () => {
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
      console.log('🚨 Starting emergency comprehensive sync...');
      
      toast({
        title: "Emergency Sync Started",
        description: "Performing comprehensive data recovery from Bybit...",
      });

      // Get credentials and initialize services
      const { CredentialsManager } = await import('@/services/trading/credentialsManager');
      const credentialsManager = new CredentialsManager(user.id);
      const bybitService = await credentialsManager.fetchCredentials();

      if (!bybitService) {
        throw new Error('Failed to get Bybit credentials');
      }

      // Run comprehensive emergency sync
      const { ComprehensiveTradeSync } = await import('@/services/trading/core/ComprehensiveTradeSync');
      const comprehensiveSync = new ComprehensiveTradeSync(user.id, bybitService);
      
      console.log('🔄 Running emergency full sync...');
      await comprehensiveSync.emergencyFullSync();

      console.log('✅ Emergency sync completed successfully');

      toast({
        title: "Emergency Sync Complete",
        description: "Successfully recovered missing trade data from Bybit",
      });

      // Notify parent component
      if (onSyncComplete) {
        onSyncComplete();
      }

    } catch (error) {
      console.error('❌ Emergency sync failed:', error);
      toast({
        title: "Emergency Sync Failed",
        description: "Failed to recover data from Bybit. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleEmergencySync}
      disabled={isSyncing}
      className="flex items-center gap-2"
    >
      <AlertTriangle className={`h-4 w-4 ${isSyncing ? 'animate-pulse' : ''}`} />
      {isSyncing ? 'Emergency Sync...' : 'Emergency Sync'}
    </Button>
  );
};

export default EmergencySyncButton;