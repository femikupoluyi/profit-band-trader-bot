
import React from 'react';
import { formatCurrency } from '@/utils/formatters';

interface TradesReportSummaryProps {
  totalTrades: number;
  activeTrades: number;
  closedTrades: number;
  totalVolume: number;
  totalPL: number;
  closedPositionsProfit: number;
}

const TradesReportSummary = ({
  totalTrades,
  activeTrades,
  closedTrades,
  totalVolume,
  totalPL,
  closedPositionsProfit
}: TradesReportSummaryProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
      <div className="bg-muted/50 p-3 rounded-lg">
        <div className="text-sm text-muted-foreground">Total Trades</div>
        <div className="text-2xl font-bold">{totalTrades}</div>
      </div>
      <div className="bg-muted/50 p-3 rounded-lg">
        <div className="text-sm text-muted-foreground">Active</div>
        <div className="text-2xl font-bold text-blue-600">{activeTrades}</div>
      </div>
      <div className="bg-muted/50 p-3 rounded-lg">
        <div className="text-sm text-muted-foreground">Closed</div>
        <div className="text-2xl font-bold text-gray-600">{closedTrades}</div>
      </div>
      <div className="bg-muted/50 p-3 rounded-lg">
        <div className="text-sm text-muted-foreground">Total Volume</div>
        <div className="text-2xl font-bold">{formatCurrency(totalVolume)}</div>
      </div>
      <div className="bg-muted/50 p-3 rounded-lg">
        <div className="text-sm text-muted-foreground">Total P&L</div>
        <div className={`text-2xl font-bold ${totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(totalPL)}
        </div>
        <div className="text-xs text-muted-foreground">Live + stored</div>
      </div>
      <div className="bg-muted/50 p-3 rounded-lg">
        <div className="text-sm text-muted-foreground">Closed P&L</div>
        <div className={`text-2xl font-bold ${closedPositionsProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(closedPositionsProfit)}
        </div>
        <div className="text-xs text-muted-foreground">Stored values</div>
      </div>
    </div>
  );
};

export default TradesReportSummary;
