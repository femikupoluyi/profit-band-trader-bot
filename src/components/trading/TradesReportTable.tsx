
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/formatters';

interface Trade {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  status: string;
  order_type: string;
  buy_fill_price?: number;
  created_at: string;
  actualPL?: number;
}

interface TradesReportTableProps {
  trades: Trade[];
}

const TradesReportTable = ({ trades }: TradesReportTableProps) => {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      filled: "default",
      pending: "secondary",
      cancelled: "outline",
      partial_filled: "secondary",
      closed: "default"
    };
    return <Badge variant={variants[status] || "outline"}>{status.replace('_', ' ')}</Badge>;
  };

  const getSideBadge = (side: string) => {
    return (
      <Badge variant={side === 'buy' ? "default" : "destructive"}>
        {side.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Symbol</TableHead>
            <TableHead>Side</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Order Price</TableHead>
            <TableHead>Fill Price</TableHead>
            <TableHead>Volume</TableHead>
            <TableHead>Actual P&L</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => {
            const quantity = trade.quantity;
            const price = trade.price;
            const fillPrice = trade.buy_fill_price;
            const effectivePrice = fillPrice || price;
            const volume = quantity * effectivePrice;
            const actualPL = trade.actualPL || 0;

            return (
              <TableRow key={trade.id}>
                <TableCell>
                  {format(new Date(trade.created_at), 'MMM dd, yyyy HH:mm')}
                </TableCell>
                <TableCell className="font-medium">{trade.symbol}</TableCell>
                <TableCell>{getSideBadge(trade.side)}</TableCell>
                <TableCell className="capitalize">{trade.order_type}</TableCell>
                <TableCell>{quantity.toFixed(6)}</TableCell>
                <TableCell>${price.toFixed(2)}</TableCell>
                <TableCell>
                  {fillPrice ? (
                    <span className={fillPrice !== price ? 'text-blue-600 font-medium' : ''}>
                      ${fillPrice.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{formatCurrency(volume)}</TableCell>
                <TableCell>
                  {actualPL !== 0 ? (
                    <span className={actualPL >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(actualPL)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(trade.status)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default TradesReportTable;
