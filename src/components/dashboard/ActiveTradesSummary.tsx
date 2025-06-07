
import React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ActiveTrade } from '@/types/trading';
import { formatCurrency, calculateSideAwarePL } from '@/utils/formatters';

interface ActiveTradesSummaryProps {
  trades: ActiveTrade[];
}

const ActiveTradesSummary = ({ trades }: ActiveTradesSummaryProps) => {
  // Only calculate P&L for filled orders using actual fill prices
  const filledTrades = trades.filter(trade => trade.status === 'filled');
  
  const totalUnrealizedPL = filledTrades.reduce((sum, trade) => {
    const currentPrice = trade.currentPrice || trade.price;
    const actualPL = calculateSideAwarePL(
      trade.side, 
      trade.price, 
      currentPrice, 
      trade.quantity,
      trade.fillPrice, // Use actual fill price if available
      trade.status
    );
    return sum + actualPL;
  }, 0);
  
  const totalVolume = trades.reduce((sum, trade) => sum + (trade.volume || 0), 0);
  
  // Calculate total position value using actual fill prices for filled orders
  const totalPositionValue = trades.reduce((sum, trade) => {
    if (trade.status === 'filled') {
      const effectivePrice = trade.fillPrice || trade.price;
      return sum + (effectivePrice * trade.quantity);
    }
    return sum + (trade.price * trade.quantity);
  }, 0);
  
  const totalCount = trades.length;
  const filledCount = filledTrades.length;
  
  // Calculate total unrealized percentage based on filled orders only
  const filledVolume = filledTrades.reduce((sum, trade) => {
    const effectivePrice = trade.fillPrice || trade.price;
    return sum + (effectivePrice * trade.quantity);
  }, 0);
  
  const totalUnrealizedPercentage = filledVolume > 0 ? (totalUnrealizedPL / filledVolume) * 100 : 0;

  console.log('Summary calculations with fill price-aware P&L:', {
    totalCount,
    filledCount,
    totalVolume: totalVolume.toFixed(2),
    filledVolume: filledVolume.toFixed(2),
    totalUnrealizedPL: totalUnrealizedPL.toFixed(2),
    totalUnrealizedPercentage: totalUnrealizedPercentage.toFixed(2),
    totalPositionValue: totalPositionValue.toFixed(2)
  });

  return (
    <TableRow className="bg-muted/50 font-medium border-t-2">
      <TableCell className="font-bold">
        Summary ({totalCount} positions, {filledCount} filled)
      </TableCell>
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
        <div className="text-xs text-muted-foreground">
          Filled orders only
        </div>
      </TableCell>
      <TableCell>
        <span className={`font-bold ${
          totalUnrealizedPercentage >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {totalUnrealizedPercentage > 0 ? '+' : ''}{totalUnrealizedPercentage.toFixed(2)}%
        </span>
        <div className="text-xs text-muted-foreground">
          Filled orders only
        </div>
      </TableCell>
      <TableCell>-</TableCell>
      <TableCell>-</TableCell>
    </TableRow>
  );
};

export default ActiveTradesSummary;
