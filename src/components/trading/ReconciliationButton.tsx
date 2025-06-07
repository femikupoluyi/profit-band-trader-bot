
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCcw, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ReconciliationButtonProps {
  onReconcile: () => Promise<void>;
}

const ReconciliationButton: React.FC<ReconciliationButtonProps> = ({ onReconcile }) => {
  const [isReconciling, setIsReconciling] = useState(false);
  const { toast } = useToast();

  const handleReconciliation = async () => {
    if (isReconciling) return;

    setIsReconciling(true);
    try {
      await onReconcile();
      toast({
        title: "Reconciliation Complete",
        description: "Successfully synchronized with Bybit transaction history",
        variant: "default",
      });
    } catch (error) {
      console.error('Reconciliation failed:', error);
      toast({
        title: "Reconciliation Failed",
        description: "Failed to synchronize with Bybit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <Button
      onClick={handleReconciliation}
      disabled={isReconciling}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isReconciling ? (
        <>
          <RefreshCcw className="h-4 w-4 animate-spin" />
          Reconciling...
        </>
      ) : (
        <>
          <CheckCircle className="h-4 w-4" />
          Sync with Bybit
        </>
      )}
    </Button>
  );
};

export default ReconciliationButton;
