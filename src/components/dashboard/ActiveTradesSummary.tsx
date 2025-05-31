
import React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ActiveTrade } from '@/types/trading';
import { formatCurrency } from '@/utils/formatters';

interface ActiveTradesSummaryProps {
  trades: ActiveTrade[];
}

const ActiveTradesSummary = ({ trades }: ActiveTradesSummaryProps) => {
  const totalUnrealizedPL = trades.reduce((sum, trade) => sum + (trade.unrealizedPL || 0), 0);
  const totalPositionValue = trades.reduce((sum, trade) => {
    const currentPrice = trade.currentPrice || trade.price;
    return sum + (currentPrice * trade.quantity);
  }, 0);
  const totalCount = trades.length;

  return (
    <TableRow className="bg-muted/50 font-medium">
      <TableCell className="font-bold">Summary ({totalCount} positions)</TableCell>
      <TableCell>-</TableCell>
      <TableCell>-</TableCell>
      <TableCell>-</TableCell>
      <TableCell className="font-medium">
        {formatCurrency(totalPositionValue)}
      </TableCell>
      <TableCell>
        <span className={`font-bold text-lg ${
          totalUnrealizedPL >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {formatCurrency(totalUnrealizedPL)}
        </span>
      </TableCell>
      <TableCell>-</TableCell>
      <TableCell>-</TableCell>
      <TableCell>-</TableCell>
    </TableRow>
  );
};

export default ActiveTradesSummary;
