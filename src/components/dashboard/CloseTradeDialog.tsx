
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
      
      // First, verify the trade exists and is not already closed
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
      if (trade.currentPrice) {
        if (currentTrade.side === 'buy') {
          profitLoss = (trade.currentPrice - currentTrade.price) * currentTrade.quantity;
        } else if (currentTrade.side === 'sell') {
          profitLoss = (currentTrade.price - trade.currentPrice) * currentTrade.quantity;
        }
      }

      // Update trade status to closed in database (only for valid statuses)
      const { error: updateError } = await supabase
        .from('trades')
        .update({
          status: 'closed',
          profit_loss: profitLoss,
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id)
        .in('status', ['pending', 'filled', 'partial_filled']);

      if (updateError) {
        console.error('Error updating trade status:', updateError);
        toast({
          title: "Error",
          description: `Failed to close trade: ${updateError.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log(`✅ Trade ${trade.id} manually closed successfully`);
      
      // Log the manual close activity with valid log type
      await supabase
        .from('trading_logs')
        .insert({
          user_id: currentTrade.user_id,
          log_type: 'position_closed',
          message: `Trade manually closed for ${trade.symbol}`,
          data: {
            tradeId: trade.id,
            symbol: trade.symbol,
            profitLoss,
            previousStatus: currentTrade.status,
            closedBy: 'manual'
          }
        });
      
      toast({
        title: "Trade Closed",
        description: `Successfully closed ${trade.symbol} position manually`,
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
          <AlertDialogTitle>Close Trade</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to manually close this {trade.symbol} position?
            <br />
            <br />
            <strong>Trade ID:</strong> {trade.id.substring(0, 8)}...
            <br />
            <strong>Current Status:</strong> {trade.status}
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
            <em>Note: This will close the position in the database only. For live trading, ensure you also close the position on the exchange.</em>
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
