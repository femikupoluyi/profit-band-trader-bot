
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
  
  // Only calculate and show P&L for buy positions that are filled (with take-profit pending)
  let spotPL = 0;
  let spotPercentage = 0;
  let showPL = false;

  if (trade.side === 'buy' && trade.status === 'filled') {
    // For spot trading, only show P&L if this is a filled buy with a pending take-profit
    showPL = shouldShowSpotPL(trade);
    
    if (showPL) {
      spotPL = calculateSpotPL(trade.price, currentPrice, trade.quantity);
      spotPercentage = calculateSpotPercentage(trade.price, currentPrice);
    }
  }

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
