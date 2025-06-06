
import React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ActiveTrade } from '@/types/trading';
import { formatCurrency, calculateSpotPL, shouldShowSpotPL, getTradeEntryPrice, getTradeVolume } from '@/utils/formatters';

interface ActiveTradesSummaryProps {
  trades: ActiveTrade[];
}

const ActiveTradesSummary = ({ trades }: ActiveTradesSummaryProps) => {
  // Calculate totals using corrected P&L logic
  const totalUnrealizedPL = trades.reduce((sum, trade) => {
    const currentPrice = trade.currentPrice || trade.price;
    
    // For closed trades, use stored profit_loss
    if (trade.status === 'closed' && trade.profit_loss !== null) {
      return sum + trade.profit_loss;
    }
    
    // For active positions, only include P&L for trades that should show P&L
    if (shouldShowSpotPL(trade)) {
      const entryPrice = getTradeEntryPrice(trade);
      const spotPL = calculateSpotPL(entryPrice, currentPrice, trade.quantity);
      return sum + spotPL;
    }
    
    return sum;
  }, 0);
  
  const totalVolume = trades.reduce((sum, trade) => sum + getTradeVolume(trade), 0);
  const totalPositionValue = trades.reduce((sum, trade) => {
    const currentPrice = trade.currentPrice || trade.price;
    return sum + (currentPrice * trade.quantity);
  }, 0);
  
  // Count trades with P&L (closed + active with linked TP)
  const tradesWithPL = trades.filter(trade => 
    trade.status === 'closed' || shouldShowSpotPL(trade)
  );
  
  const totalCount = trades.length;
  const activePLCount = tradesWithPL.length;
  
  // Calculate total unrealized percentage based on total volume for positions with P&L
  const totalVolumeWithPL = tradesWithPL.reduce((sum, trade) => sum + getTradeVolume(trade), 0);
  const totalUnrealizedPercentage = totalVolumeWithPL > 0 ? (totalUnrealizedPL / totalVolumeWithPL) * 100 : 0;

  console.log('Summary calculations with corrected logic:', {
    totalCount,
    activePLCount,
    totalVolume: totalVolume.toFixed(2),
    totalVolumeWithPL: totalVolumeWithPL.toFixed(2),
    totalUnrealizedPL: totalUnrealizedPL.toFixed(2),
    totalUnrealizedPercentage: totalUnrealizedPercentage.toFixed(2),
    totalPositionValue: totalPositionValue.toFixed(2)
  });

  return (
    <TableRow className="bg-muted/50 font-medium border-t-2">
      <TableCell className="font-bold">Summary ({totalCount} positions, {activePLCount} with P&L)</TableCell>
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
