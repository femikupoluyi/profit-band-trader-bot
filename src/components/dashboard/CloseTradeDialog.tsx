
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

interface CloseTradeDialogProps {
  trade: ActiveTrade;
  isClosing: boolean;
  onClose: (trade: ActiveTrade) => void;
}

const CloseTradeDialog = ({ trade, isClosing, onClose }: CloseTradeDialogProps) => {
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
            onClick={() => onClose(trade)}
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
