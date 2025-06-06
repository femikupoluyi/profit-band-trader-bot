
import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { ActiveTrade } from '@/types/trading';
import { formatCurrency } from '@/utils/formatters';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { BybitService } from '@/services/bybitService';
import { ManualCloseService } from '@/services/trading/core/ManualCloseService';

interface CloseTradeDialogProps {
  trade: ActiveTrade;
  isClosing: boolean;
  onClose: (trade: ActiveTrade) => void;
}

const CloseTradeDialog = ({ trade, isClosing: externalClosing, onClose }: CloseTradeDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleManualClose = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log(`🔄 Initiating manual close for trade ${trade.id} (${trade.symbol})`);
      
      // Initialize Bybit service - using demo trading for safety
      const bybitService = new BybitService(); // Fixed constructor call
      const manualCloseService = new ManualCloseService(user.id, bybitService);
      
      // Execute the manual close
      const result = await manualCloseService.closePosition(trade.id);
      
      if (result.success) {
        console.log(`✅ Manual close successful:`, result);
        
        toast({
          title: "Position Closed",
          description: result.message,
        });
        
        // Immediately update the UI to reflect the closed position
        onClose(trade);
        
      } else {
        console.error(`❌ Manual close failed:`, result);
        
        toast({
          title: "Close Failed",
          description: result.message,
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('❌ Unexpected error during manual close:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred while closing the position';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isClosing = externalClosing || isProcessing;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          disabled={isClosing || trade.status === 'closed'}
          className="h-8 w-8 p-0"
        >
          {isClosing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close Position on Exchange</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to close this {trade.symbol} position on Bybit?
            <br />
            <br />
            <strong>Trade ID:</strong> {trade.id.substring(0, 8)}...
            <br />
            <strong>Current Status:</strong> {trade.status}
            <br />
            <strong>Side:</strong> {trade.side.toUpperCase()}
            <br />
            <strong>Entry Price:</strong> ${trade.price?.toFixed(6) || 'N/A'}
            <br />
            <strong>Quantity:</strong> {trade.quantity}
            <br />
            <strong>Current P&L:</strong> <span className={`font-medium ${
              (trade.unrealizedPL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(trade.unrealizedPL || 0)}
            </span>
            <br />
            <br />
            <em className="text-blue-600">
              This will place a market sell order on Bybit to close your position. 
              The position will only be marked as closed locally after Bybit confirms the order.
            </em>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleManualClose}
            disabled={isProcessing}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Closing...
              </>
            ) : (
              'Close on Exchange'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CloseTradeDialog;
