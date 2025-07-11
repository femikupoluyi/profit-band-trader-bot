import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { performReconciliationAnalysis } from '@/utils/performReconciliationAnalysis';

interface BybitDataFetcherProps {
  onDataFetched?: () => void;
}

const BybitDataFetcher = ({ onDataFetched }: BybitDataFetcherProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFetching, setIsFetching] = useState(false);

  const handleFetchData = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setIsFetching(true);
    try {
      console.log('🔍 Fetching Bybit data for reconciliation...');
      
      toast({
        title: "Fetching Data",
        description: "Downloading 7-day trading history from Bybit...",
      });

      const result = await performReconciliationAnalysis(user.id);
      
      if (result.success) {
        console.log('📊 Bybit Data Analysis Complete:', result.report);
        toast({
          title: "Data Fetched",
          description: "Bybit data downloaded and analyzed successfully. Check console for detailed report.",
        });
        
        if (onDataFetched) {
          onDataFetched();
        }
      } else {
        toast({
          title: "Fetch Failed",
          description: result.error,
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('❌ Bybit data fetch failed:', error);
      toast({
        title: "Fetch Failed",
        description: "Failed to fetch Bybit data. Check API credentials.",
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleFetchData}
      disabled={isFetching}
      className="flex items-center gap-2"
    >
      <Download className={`h-4 w-4 ${isFetching ? 'animate-pulse' : ''}`} />
      {isFetching ? 'Fetching...' : 'Fetch Bybit Data'}
    </Button>
  );
};

export default BybitDataFetcher;