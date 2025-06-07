
import React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ActiveTrade } from '@/types/trading';
import { formatCurrency, calculateSideAwarePL, calculateSideAwarePercentage } from '@/utils/formatters';
import CloseTradeDialog from './CloseTradeDialog';

interface ActiveTradeRowProps {
  trade: ActiveTrade;
  isClosing: boolean;
  onClose: (trade: ActiveTrade) => void;
}

const ActiveTradeRow = ({ trade, isClosing, onClose }: ActiveTradeRowProps) => {
  const currentPrice = trade.currentPrice || trade.price;
  
  // Calculate side-aware P&L and percentage
  const sideAwarePL = calculateSideAwarePL(trade.side, trade.price, currentPrice, trade.quantity);
  const sideAwarePercentage = calculateSideAwarePercentage(trade.side, trade.price, currentPrice);

  return (
    <TableRow>
      <TableCell className="font-medium">{trade.symbol}</TableCell>
      <TableCell>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          trade.side === 'buy' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {trade.side.toUpperCase()}
        </span>
      </TableCell>
      <TableCell>{trade.quantity.toFixed(8)}</TableCell>
      <TableCell>{formatCurrency(trade.price)}</TableCell>
      <TableCell>{formatCurrency(currentPrice)}</TableCell>
      <TableCell>{formatCurrency(trade.volume || 0)}</TableCell>
      <TableCell>
        <span className={`font-medium ${
          sideAwarePL >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {formatCurrency(sideAwarePL)}
        </span>
      </TableCell>
      <TableCell>
        <span className={`font-medium ${
          sideAwarePercentage >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {sideAwarePercentage > 0 ? '+' : ''}{sideAwarePercentage.toFixed(2)}%
        </span>
      </TableCell>
      <TableCell>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          trade.status === 'filled' 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {trade.status.toUpperCase()}
        </span>
      </TableCell>
      <TableCell>
        <CloseTradeDialog
          trade={trade}
          isClosing={isClosing}
          onClose={onClose}
        />
      </TableCell>
    </TableRow>
  );
};

export default ActiveTradeRow;
