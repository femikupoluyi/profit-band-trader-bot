
import React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ActiveTrade } from '@/types/trading';
import { formatCurrency } from '@/utils/formatters';

interface ActiveTradesSummaryProps {
  trades: ActiveTrade[];
}

const ActiveTradesSummary = ({ trades }: ActiveTradesSummaryProps) => {
  const totalUnrealizedPL = trades.reduce((sum, trade) => sum + (trade.unrealizedPL || 0), 0);
  const totalVolume = trades.reduce((sum, trade) => sum + (trade.volume || 0), 0);
  const totalPositionValue = trades.reduce((sum, trade) => {
    const currentPrice = trade.currentPrice || trade.price;
    return sum + (currentPrice * trade.quantity);
  }, 0);
  const totalCount = trades.length;
  
  // Calculate total unrealized percentage based on total volume invested
  const totalUnrealizedPercentage = totalVolume > 0 ? (totalUnrealizedPL / totalVolume) * 100 : 0;

  console.log('Summary calculations:', {
    totalCount,
    totalVolume: totalVolume.toFixed(2),
    totalUnrealizedPL: totalUnrealizedPL.toFixed(2),
    totalUnrealizedPercentage: totalUnrealizedPercentage.toFixed(2),
    totalPositionValue: totalPositionValue.toFixed(2)
  });

  return (
    <TableRow className="bg-muted/50 font-medium border-t-2">
      <TableCell className="font-bold">Summary ({totalCount} positions)</TableCell>
      <TableCell>-</TableCell>
      <TableCell>-</TableCell>
      <TableCell>-</TableCell>
      <TableCell>-</TableCell>
      <TableCell className="font-medium">
        {formatCurrency(totalVolume)}
      </TableCell>
      <TableCell>
        <span className={`font-bold text-lg ${
          totalUnrealizedPL >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {formatCurrency(totalUnrealizedPL)}
        </span>
      </TableCell>
      <TableCell>
        <span className={`font-bold ${
          totalUnrealizedPercentage >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {totalUnrealizedPercentage > 0 ? '+' : ''}{totalUnrealizedPercentage.toFixed(2)}%
        </span>
      </TableCell>
      <TableCell>-</TableCell>
      <TableCell>-</TableCell>
    </TableRow>
  );
};

export default ActiveTradesSummary;
