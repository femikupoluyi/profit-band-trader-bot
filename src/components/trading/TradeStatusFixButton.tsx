import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { fixIncorrectlyClosedTrades } from '@/utils/tradeStatusFixer';

interface TradeStatusFixButtonProps {
  onFixComplete?: () => void;
}

const TradeStatusFixButton = ({ onFixComplete }: TradeStatusFixButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFixing, setIsFixing] = useState(false);

  const handleFix = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setIsFixing(true);
    try {
      console.log('🔧 Starting trade status fix...');
      
      toast({
        title: "Fix Started",
        description: "Fixing incorrectly closed trades...",
      });

      const result = await fixIncorrectlyClosedTrades(user.id);
      
      if (result.success) {
        toast({
          title: "Fix Complete",
          description: result.message,
        });
        
        // Notify parent component
        if (onFixComplete) {
          onFixComplete();
        }
      } else {
        toast({
          title: "Fix Failed",
          description: result.message,
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('❌ Fix failed:', error);
      toast({
        title: "Fix Failed",
        description: "Failed to fix trade statuses. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleFix}
      disabled={isFixing}
      className="flex items-center gap-2"
    >
      <Settings className={`h-4 w-4 ${isFixing ? 'animate-spin' : ''}`} />
      {isFixing ? 'Fixing...' : 'Fix Trade Status'}
    </Button>
  );
};

export default TradeStatusFixButton;