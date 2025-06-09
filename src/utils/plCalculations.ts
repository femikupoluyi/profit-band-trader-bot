
import { calculateSideAwarePL } from '@/utils/formatters';
import { getCurrentPrice } from './priceUtils';

export const calculateActualPL = async (trade: any, userId: string) => {
  try {
    const entryPrice = parseFloat(trade.price.toString());
    const quantity = parseFloat(trade.quantity.toString());
    const fillPrice = trade.buy_fill_price ? parseFloat(trade.buy_fill_price.toString()) : null;

    // For closed trades, use the stored profit_loss if it exists and is reasonable
    if (['closed', 'cancelled'].includes(trade.status)) {
      if (trade.profit_loss !== null && trade.profit_loss !== undefined) {
        const storedPL = parseFloat(trade.profit_loss.toString());
        console.log(`Using stored P&L for closed trade ${trade.symbol}: $${storedPL}`);
        return storedPL;
      }
      return 0;
    }

    // For active filled trades, calculate real-time P&L
    if (trade.status === 'filled') {
      const currentPrice = await getCurrentPrice(trade.symbol, userId);
      
      if (currentPrice) {
        const actualPL = calculateSideAwarePL(
          trade.side, 
          entryPrice, 
          currentPrice, 
          quantity,
          fillPrice,
          trade.status
        );
        
        console.log(`Calculated P&L for ${trade.symbol}: Entry=$${entryPrice}, Current=$${currentPrice}, P&L=$${actualPL}`);
        return actualPL;
      }
    }

    return 0;
  } catch (error) {
    console.error(`Error calculating P&L for trade ${trade.id}:`, error);
    return 0;
  }
};

export const calculateTradeMetrics = (trades: any[]) => {
  const totalTrades = trades.length;
  const closedTrades = trades.filter(t => ['closed', 'cancelled'].includes(t.status));
  const filledTrades = trades.filter(t => t.status === 'filled');
  
  let totalProfit = 0;
  let closedPositionsProfit = 0;
  let totalVolume = 0;
  let profitableClosedCount = 0;

  trades.forEach(trade => {
    const price = parseFloat(trade.price.toString());
    const quantity = parseFloat(trade.quantity.toString());
    const fillPrice = trade.buy_fill_price ? parseFloat(trade.buy_fill_price.toString()) : null;
    const effectivePrice = fillPrice || price;
    const volume = effectivePrice * quantity;
    const actualPL = trade.actualPL || 0;
    
    totalProfit += actualPL;
    totalVolume += volume;
    
    // Add to closed positions profit only if trade is closed
    if (['closed', 'cancelled'].includes(trade.status)) {
      closedPositionsProfit += actualPL;
      
      // Count closed and cancelled trades with positive actual P&L as profitable
      if (actualPL > 0) {
        profitableClosedCount++;
      }
    }
  });

  // Calculate profit percentage based on closed trades only
  const profitPercentage = closedTrades.length > 0 ? (profitableClosedCount / closedTrades.length) * 100 : 0;

  return {
    totalTrades,
    closedTrades: closedTrades.length,
    filledTrades: filledTrades.length,
    totalProfit: Math.round(totalProfit * 100) / 100,
    closedPositionsProfit: Math.round(closedPositionsProfit * 100) / 100,
    totalVolume: Math.round(totalVolume * 100) / 100,
    profitPercentage: Math.round(profitPercentage * 100) / 100,
    profitableClosedCount
  };
};
