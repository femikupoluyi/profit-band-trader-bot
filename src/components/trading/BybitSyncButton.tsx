
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { CredentialsManager } from '@/services/trading/credentialsManager';
import { supabase } from '@/integrations/supabase/client';

interface BybitSyncButtonProps {
  onSyncComplete?: () => void;
}

const BybitSyncButton = ({ onSyncComplete }: BybitSyncButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  const syncBybitData = async () => {
    if (!user) {
      console.error('❌ No user found for sync');
      return;
    }

    setIsSyncing(true);
    console.log('🔄 Starting Bybit data sync for user:', user.id);
    
    try {
      // Get user's credentials
      const credentialsManager = new CredentialsManager(user.id);
      const bybitService = await credentialsManager.fetchCredentials();
      
      if (!bybitService) {
        console.error('❌ No Bybit credentials found');
        toast({
          title: "Error",
          description: "No Bybit credentials found. Please configure your API credentials first.",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ Bybit service initialized, fetching order history...');

      // Fetch order history from Bybit with error handling
      let orderHistoryResponse;
      try {
        orderHistoryResponse = await bybitService.getOrderHistory(100);
        console.log('📥 Raw Bybit response:', orderHistoryResponse);
      } catch (apiError) {
        console.error('❌ Bybit API call failed:', apiError);
        toast({
          title: "API Error",
          description: `Failed to connect to Bybit API: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`,
          variant: "destructive",
        });
        return;
      }
      
      if (!orderHistoryResponse || orderHistoryResponse.retCode !== 0) {
        const errorMsg = orderHistoryResponse?.retMsg || 'Unknown API error';
        console.error('❌ Bybit API error:', errorMsg);
        throw new Error(`Bybit API error: ${errorMsg}`);
      }

      const orders = orderHistoryResponse.result?.list || [];
      console.log(`✅ Retrieved ${orders.length} orders from Bybit`);

      if (orders.length === 0) {
        toast({
          title: "No Data",
          description: "No orders found in your Bybit account.",
        });
        return;
      }

      // Process and insert orders into our database
      let syncedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const order of orders) {
        try {
          console.log('🔍 Processing order:', {
            orderId: order.orderId,
            symbol: order.symbol,
            side: order.side,
            status: order.orderStatus,
            qty: order.qty,
            price: order.price,
            avgPrice: order.avgPrice
          });

          // Check if order already exists
          const { data: existingTrade } = await supabase
            .from('trades')
            .select('id')
            .eq('bybit_order_id', order.orderId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (existingTrade) {
            console.log('⏭️ Skipping existing trade:', order.orderId);
            skippedCount++;
            continue;
          }

          // Parse numeric values safely
          const quantity = parseFloat(order.qty || '0');
          const price = parseFloat(order.price || '0');
          const avgPrice = order.avgPrice ? parseFloat(order.avgPrice) : null;
          const cumExecFee = parseFloat(order.cumExecFee || '0');

          // Calculate profit/loss for filled orders
          let profitLoss = 0;
          if (order.orderStatus === 'Filled' && avgPrice) {
            // For filled orders, store the fee as negative P&L for now
            // This will be updated by the P&L calculation system later
            profitLoss = -Math.abs(cumExecFee);
          }

          // Validate required fields
          if (!order.symbol || !order.side || quantity <= 0 || price <= 0) {
            console.warn('⚠️ Invalid order data, skipping:', order.orderId);
            errorCount++;
            continue;
          }

          // Insert new trade record with proper validation
          const tradeData = {
            user_id: user.id,
            symbol: order.symbol,
            side: order.side.toLowerCase(),
            quantity: quantity,
            price: price,
            status: order.orderStatus.toLowerCase().replace(' ', '_'),
            order_type: (order.orderType || 'market').toLowerCase(),
            bybit_order_id: order.orderId,
            buy_fill_price: avgPrice,
            profit_loss: profitLoss,
            created_at: order.createdTime ? new Date(parseInt(order.createdTime)).toISOString() : new Date().toISOString(),
            updated_at: order.updatedTime ? new Date(parseInt(order.updatedTime)).toISOString() : new Date().toISOString(),
          };

          console.log('💾 Inserting trade:', tradeData);

          const { error: insertError } = await supabase
            .from('trades')
            .insert(tradeData);

          if (insertError) {
            console.error('❌ Error inserting trade:', insertError);
            errorCount++;
          } else {
            console.log('✅ Successfully inserted trade:', order.orderId);
            syncedCount++;
          }
        } catch (error) {
          console.error('❌ Error processing order:', order.orderId, error);
          errorCount++;
        }
      }

      const message = `Synced ${syncedCount} new trades from Bybit. Skipped ${skippedCount} existing trades.${errorCount > 0 ? ` ${errorCount} errors occurred.` : ''}`;
      
      toast({
        title: "Sync Complete",
        description: message,
        variant: errorCount > 0 ? "destructive" : "default",
      });

      console.log(`✅ Sync complete: ${syncedCount} new, ${skippedCount} skipped, ${errorCount} errors`);
      
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
      disabled={isSyncing || !user}
      className="flex items-center gap-2"
    >
      {isSyncing ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isSyncing ? 'Syncing...' : 'Sync from Bybit'}
    </Button>
  );
};

export default BybitSyncButton;
