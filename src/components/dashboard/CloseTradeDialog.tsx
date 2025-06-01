
import React from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CloseTradeDialogProps {
  trade: ActiveTrade;
  isClosing: boolean;
  onClose: (trade: ActiveTrade) => void;
}

const CloseTradeDialog = ({ trade, isClosing, onClose }: CloseTradeDialogProps) => {
  const { toast } = useToast();

  const handleManualClose = async () => {
    try {
      console.log(`Manually closing trade ${trade.id} for ${trade.symbol}`);
      console.log(`Trade current status: ${trade.status}`);
      
      // First, verify the trade exists and get its current status
      const { data: currentTrade, error: fetchError } = await supabase
        .from('trades')
        .select('*')
        .eq('id', trade.id)
        .single();

      if (fetchError) {
        console.error('Error fetching current trade:', fetchError);
        toast({
          title: "Error",
          description: "Trade not found in database",
          variant: "destructive",
        });
        return;
      }

      console.log('Current trade data:', currentTrade);

      // Only update if trade is not already closed
      if (currentTrade.status === 'closed') {
        console.log('Trade is already closed');
        toast({
          title: "Info",
          description: "Trade is already closed",
        });
        onClose(trade);
        return;
      }

      // Calculate current P&L if we have current price
      let profitLoss = 0;
      if (trade.currentPrice && currentTrade.side === 'buy') {
        profitLoss = (trade.currentPrice - currentTrade.price) * currentTrade.quantity;
      } else if (trade.currentPrice && currentTrade.side === 'sell') {
        profitLoss = (currentTrade.price - trade.currentPrice) * currentTrade.quantity;
      }

      // Update trade status to closed in database
      // Only update trades that are in valid statuses that can be closed
      const { error } = await supabase
        .from('trades')
        .update({
          status: 'closed',
          profit_loss: profitLoss,
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id)
        .in('status', ['pending', 'filled']); // Only close pending or filled trades

      if (error) {
        console.error('Error updating trade status:', error);
        toast({
          title: "Error",
          description: `Failed to close trade: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log(`✅ Trade ${trade.id} manually closed successfully`);
      
      toast({
        title: "Trade Closed",
        description: `Successfully closed ${trade.symbol} position`,
      });

      // Call the parent callback to refresh the UI
      onClose(trade);

    } catch (error) {
      console.error('Error in manual close:', error);
      toast({
        title: "Error",
        description: `Failed to close trade: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          disabled={isClosing}
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
          <AlertDialogTitle>Close Trade</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to manually close this {trade.symbol} position?
            <br />
            <br />
            <strong>Trade ID:</strong> {trade.id}
            <br />
            <strong>Current Status:</strong> {trade.status}
            <br />
            <strong>Current P&L:</strong> <span className={`font-medium ${
              (trade.unrealizedPL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(trade.unrealizedPL || 0)}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleManualClose}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Close Position
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CloseTradeDialog;
