
import React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ActiveTrade } from '@/types/trading';
import { formatCurrency, calculateSideAwarePL, validateNumericValue } from '@/utils/formatters';

interface ActiveTradesSummaryProps {
  trades: ActiveTrade[];
}

const ActiveTradesSummary = ({ trades }: ActiveTradesSummaryProps) => {
  // Validate trades array
  if (!Array.isArray(trades) || trades.length === 0) {
    return (
      <TableRow className="bg-muted/50 font-medium border-t-2">
        <TableCell className="font-bold" colSpan={10}>
          No active trades
        </TableCell>
      </TableRow>
    );
  }

  // Only calculate P&L for filled orders using validated data
  const filledTrades = trades.filter(trade => trade && trade.status === 'filled');
  
  const totalUnrealizedPL = filledTrades.reduce((sum, trade) => {
    try {
      const entryPrice = validateNumericValue(trade.price, 'entry price');
      const currentPrice = validateNumericValue(trade.currentPrice || trade.price, 'current price');
      const quantity = validateNumericValue(trade.quantity, 'quantity');
      const fillPrice = trade.fillPrice ? validateNumericValue(trade.fillPrice, 'fill price') : null;
      
      if (entryPrice <= 0 || currentPrice <= 0 || quantity <= 0) {
        console.warn('Invalid trade data for summary calculation:', trade.id);
        return sum;
      }
      
      const actualPL = calculateSideAwarePL(
        trade.side, 
        entryPrice, 
        currentPrice, 
        quantity,
        fillPrice,
        trade.status
      );
      
      return sum + actualPL;
    } catch (error) {
      console.error('Error calculating P&L for summary:', error);
      return sum;
    }
  }, 0);
  
  const totalVolume = trades.reduce((sum, trade) => {
    try {
      const price = validateNumericValue(trade.price, 'price');
      const quantity = validateNumericValue(trade.quantity, 'quantity');
      const fillPrice = trade.fillPrice ? validateNumericValue(trade.fillPrice, 'fill price') : null;
      
      // Use fill price for filled orders if available
      let effectivePrice = price;
      if (trade.status === 'filled' && fillPrice && fillPrice > 0) {
        effectivePrice = fillPrice;
      }
      
      const volume = effectivePrice * quantity;
      return sum + (volume > 0 ? volume : 0);
    } catch (error) {
      console.error('Error calculating volume for summary:', error);
      return sum;
    }
  }, 0);
  
  // Calculate total position value using validated data
  const totalPositionValue = trades.reduce((sum, trade) => {
    try {
      const price = validateNumericValue(trade.price, 'price');
      const quantity = validateNumericValue(trade.quantity, 'quantity');
      const fillPrice = trade.fillPrice ? validateNumericValue(trade.fillPrice, 'fill price') : null;
      
      let effectivePrice = price;
      if (trade.status === 'filled' && fillPrice && fillPrice > 0) {
        effectivePrice = fillPrice;
      }
      
      const positionValue = effectivePrice * quantity;
      return sum + (positionValue > 0 ? positionValue : 0);
    } catch (error) {
      console.error('Error calculating position value for summary:', error);
      return sum;
    }
  }, 0);
  
  const totalCount = trades.length;
  const filledCount = filledTrades.length;
  
  // Calculate total unrealized percentage based on filled orders only
  const filledVolume = filledTrades.reduce((sum, trade) => {
    try {
      const price = validateNumericValue(trade.price, 'price');
      const quantity = validateNumericValue(trade.quantity, 'quantity');
      const fillPrice = trade.fillPrice ? validateNumericValue(trade.fillPrice, 'fill price') : null;
      
      const effectivePrice = fillPrice && fillPrice > 0 ? fillPrice : price;
      const volume = effectivePrice * quantity;
      return sum + (volume > 0 ? volume : 0);
    } catch (error) {
      console.error('Error calculating filled volume for summary:', error);
      return sum;
    }
  }, 0);
  
  const totalUnrealizedPercentage = filledVolume > 0 ? (totalUnrealizedPL / filledVolume) * 100 : 0;

  console.log('Summary calculations with enhanced validation:', {
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
