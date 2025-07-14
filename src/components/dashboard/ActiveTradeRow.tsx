
import React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ActiveTrade } from '@/types/trading';
import { formatCurrency, calculateSideAwarePL, calculateSideAwarePercentage, validateNumericValue } from '@/utils/formatters';
import CloseTradeDialog from './CloseTradeDialog';

interface ActiveTradeRowProps {
  trade: ActiveTrade;
  isClosing: boolean;
  onClose: (trade: ActiveTrade) => void;
}

const ActiveTradeRow = ({ trade, isClosing, onClose }: ActiveTradeRowProps) => {
  // Validate and sanitize trade data
  const entryPrice = validateNumericValue(trade.price, 'entry price');
  const quantity = validateNumericValue(trade.quantity, 'quantity');
  const currentPrice = validateNumericValue(trade.currentPrice || trade.price, 'current price');
  const fillPrice = trade.fillPrice ? validateNumericValue(trade.fillPrice, 'fill price') : null;
  
  // Calculate side-aware P&L and percentage using validated data
  const sideAwarePL = calculateSideAwarePL(
    trade.side, 
    entryPrice, 
    currentPrice, 
    quantity,
    fillPrice,
    trade.status
  );
  
  const sideAwarePercentage = calculateSideAwarePercentage(
    trade.side, 
    entryPrice, 
    currentPrice,
    fillPrice,
    trade.status
  );

  // Display price used for calculations
  const effectiveEntryPrice = trade.status === 'filled' && fillPrice && fillPrice > 0 ? fillPrice : entryPrice;
  
  // Calculate volume using effective price
  const volume = validateNumericValue(trade.volume || (effectiveEntryPrice * quantity), 'volume');

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
      <TableCell>{quantity.toFixed(8)}</TableCell>
      <TableCell>
        {formatCurrency(effectiveEntryPrice)}
        {trade.status === 'filled' && fillPrice && fillPrice > 0 && Math.abs(fillPrice - entryPrice) > 0.0001 && (
          <div className="text-xs text-muted-foreground">
            Original: {formatCurrency(entryPrice)}
          </div>
        )}
      </TableCell>
      <TableCell>{formatCurrency(currentPrice)}</TableCell>
      <TableCell>{formatCurrency(volume)}</TableCell>
      <TableCell>
        {trade.status === 'filled' ? (
          <span className={`font-medium ${
            sideAwarePL >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(sideAwarePL)}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {trade.status === 'filled' ? (
          <span className={`font-medium ${
            sideAwarePercentage >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {sideAwarePercentage > 0 ? '+' : ''}{sideAwarePercentage.toFixed(2)}%
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
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
      <TableCell className="text-sm text-muted-foreground">
        {new Date(trade.created_at).toLocaleString()}
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
