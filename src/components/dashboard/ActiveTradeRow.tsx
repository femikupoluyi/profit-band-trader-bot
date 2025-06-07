
import React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ActiveTrade } from '@/types/trading';
import { formatCurrency, formatPercentage } from '@/utils/formatters';
import CloseTradeDialog from './CloseTradeDialog';

interface ActiveTradeRowProps {
  trade: ActiveTrade;
  isClosing: boolean;
  onClose: (trade: ActiveTrade) => void;
}

const ActiveTradeRow = ({ trade, isClosing, onClose }: ActiveTradeRowProps) => {
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
      <TableCell>{formatCurrency(trade.currentPrice || trade.price)}</TableCell>
      <TableCell>{formatCurrency(trade.volume || 0)}</TableCell>
      <TableCell>
        <span className={`font-medium ${
          (trade.unrealizedPL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {formatCurrency(trade.unrealizedPL || 0)}
        </span>
      </TableCell>
      <TableCell>
        <span className={`font-medium ${
          (trade.currentPrice || trade.price) >= trade.price ? 'text-green-600' : 'text-red-600'
        }`}>
          {formatPercentage(trade.price, trade.currentPrice || trade.price)}
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
