
import React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ActiveTrade } from '@/types/trading';
import { formatCurrency, calculateSpotPL, calculateSpotPercentage, shouldShowSpotPL } from '@/utils/formatters';
import CloseTradeDialog from './CloseTradeDialog';

interface ActiveTradeRowProps {
  trade: ActiveTrade;
  isClosing: boolean;
  onClose: (trade: ActiveTrade) => void;
}

const ActiveTradeRow = ({ trade, isClosing, onClose }: ActiveTradeRowProps) => {
  const currentPrice = trade.currentPrice || trade.price;
  
  // Calculate P&L only for filled buy positions using spot logic
  let spotPL = 0;
  let spotPercentage = 0;
  let showPL = false;

  // Use the spot P&L logic to determine if we should show P&L
  if (shouldShowSpotPL(trade)) {
    showPL = true;
    spotPL = calculateSpotPL(trade.price, currentPrice, trade.quantity);
    spotPercentage = calculateSpotPercentage(trade.price, currentPrice);
  }

  console.log(`ActiveTradeRow ${trade.symbol}: Side=${trade.side}, Status=${trade.status}, ShowPL=${showPL}, EntryPrice=${trade.price}, CurrentPrice=${currentPrice}, SpotPL=${spotPL.toFixed(2)}, SpotPercentage=${spotPercentage.toFixed(2)}%`);

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
        {showPL ? (
          <span className={`font-medium ${
            spotPL >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(spotPL)}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </TableCell>
      <TableCell>
        {showPL ? (
          <span className={`font-medium ${
            spotPercentage >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {spotPercentage > 0 ? '+' : ''}{spotPercentage.toFixed(2)}%
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
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
