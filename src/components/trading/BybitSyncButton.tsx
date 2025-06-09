
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { CredentialsManager } from '@/services/trading/credentialsManager';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface BybitSyncButtonProps {
  onSyncComplete?: () => void;
}

const BybitSyncButton = ({ onSyncComplete }: BybitSyncButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSync, setIsSyncing] = useState(false);

  const syncBybitData = async () => {
    if (!user) return;

    setIsSyncing(true);
    try {
      console.log('🔄 Starting Bybit data sync...');
      
      // Get user's credentials
      const credentialsManager = new CredentialsManager(user.id);
      const bybitService = await credentialsManager.fetchCredentials();
      
      if (!bybitService) {
        toast({
          title: "Error",
          description: "No Bybit credentials found. Please configure your API credentials first.",
          variant: "destructive",
        });
        return;
      }

      // Fetch order history from Bybit
      console.log('📊 Fetching order history from Bybit...');
      const orderHistoryResponse = await bybitService.getOrderHistory(100);
      
      if (orderHistoryResponse.retCode !== 0) {
        throw new Error(`Bybit API error: ${orderHistoryResponse.retMsg}`);
      }

      const orders = orderHistoryResponse.result?.list || [];
      console.log(`✅ Retrieved ${orders.length} orders from Bybit`);

      // Process and insert orders into our database
      let syncedCount = 0;
      let skippedCount = 0;

      for (const order of orders) {
        try {
          // Check if order already exists
          const { data: existingTrade } = await supabase
            .from('trades')
            .select('id')
            .eq('bybit_order_id', order.orderId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (existingTrade) {
            skippedCount++;
            continue;
          }

          // Calculate profit/loss for filled orders
          let profitLoss = 0;
          if (order.orderStatus === 'Filled') {
            const quantity = parseFloat(order.cumExecQty);
            const avgPrice = parseFloat(order.avgPrice);
            const fee = parseFloat(order.cumExecFee);
            
            // Simple P&L calculation (this would be more complex in reality)
            if (order.side === 'Buy') {
              // For buy orders, we'll calculate P&L when they're sold
              profitLoss = -fee; // Just subtract the fee for now
            } else {
              // For sell orders, calculate basic profit
              profitLoss = -fee; // Simplified calculation
            }
          }

          // Insert new trade record
          const { error: insertError } = await supabase
            .from('trades')
            .insert({
              user_id: user.id,
              symbol: order.symbol,
              side: order.side.toLowerCase(),
              quantity: parseFloat(order.qty),
              price: parseFloat(order.price),
              status: order.orderStatus.toLowerCase().replace(' ', '_'),
              order_type: order.orderType.toLowerCase(),
              bybit_order_id: order.orderId,
              buy_fill_price: order.avgPrice ? parseFloat(order.avgPrice) : null,
              profit_loss: profitLoss,
              created_at: new Date(parseInt(order.createdTime)).toISOString(),
              updated_at: new Date(parseInt(order.updatedTime)).toISOString(),
            });

          if (insertError) {
            console.error('Error inserting trade:', insertError);
          } else {
            syncedCount++;
          }
        } catch (error) {
          console.error('Error processing order:', error);
        }
      }

      toast({
        title: "Sync Complete",
        description: `Synced ${syncedCount} new trades from Bybit. Skipped ${skippedCount} existing trades.`,
      });

      console.log(`✅ Sync complete: ${syncedCount} new, ${skippedCount} skipped`);
      
      if (onSyncComplete) {
        onSyncComplete();
      }

    } catch (error) {
      console.error('❌ Error syncing Bybit data:', error);
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync data from Bybit.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button 
      onClick={syncBybitData} 
      disabled={isSync || !user}
      className="flex items-center gap-2"
    >
      {isSync ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isSync ? 'Syncing...' : 'Sync from Bybit'}
    </Button>
  );
};

export default BybitSyncButton;
