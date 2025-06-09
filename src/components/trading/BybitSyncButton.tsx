
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
      toast({
        title: "Error",
        description: "Please log in to sync data from Bybit.",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    console.log('🔄 Starting Bybit data sync for user:', user.id);
    
    try {
      // Get user's credentials with proper error handling
      const credentialsManager = new CredentialsManager(user.id);
      let bybitService;
      
      try {
        bybitService = await credentialsManager.fetchCredentials();
      } catch (credError) {
        console.error('❌ Failed to fetch credentials:', credError);
        toast({
          title: "Credentials Error",
          description: "Failed to load your API credentials. Please check your settings.",
          variant: "destructive",
        });
        return;
      }
      
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

      // Fetch order history from Bybit with proper error handling
      let orderHistoryResponse;
      try {
        orderHistoryResponse = await bybitService.getOrderHistory(100);
        console.log('📥 Raw Bybit response:', orderHistoryResponse);
      } catch (apiError) {
        console.error('❌ Bybit API call failed:', apiError);
        const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';
        toast({
          title: "API Error",
          description: `Failed to connect to Bybit API: ${errorMessage}`,
          variant: "destructive",
        });
        return;
      }
      
      // Validate API response structure
      if (!orderHistoryResponse) {
        console.error('❌ Empty response from Bybit API');
        toast({
          title: "API Error",
          description: "Received empty response from Bybit API.",
          variant: "destructive",
        });
        return;
      }

      if (orderHistoryResponse.retCode !== 0) {
        const errorMsg = orderHistoryResponse.retMsg || 'Unknown API error';
        console.error('❌ Bybit API error:', errorMsg);
        toast({
          title: "API Error",
          description: `Bybit API error: ${errorMsg}`,
          variant: "destructive",
        });
        return;
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
          // Validate required order fields
          if (!order.orderId || !order.symbol || !order.side) {
            console.warn('⚠️ Invalid order data, missing required fields:', order.orderId);
            errorCount++;
            continue;
          }

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
          const { data: existingTrade, error: checkError } = await supabase
            .from('trades')
            .select('id')
            .eq('bybit_order_id', order.orderId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (checkError) {
            console.error('❌ Error checking existing trade:', checkError);
            errorCount++;
            continue;
          }

          if (existingTrade) {
            console.log('⏭️ Skipping existing trade:', order.orderId);
            skippedCount++;
            continue;
          }

          // Parse and validate numeric values
          const quantity = parseFloat(order.qty || '0');
          const price = parseFloat(order.price || '0');
          const avgPrice = order.avgPrice ? parseFloat(order.avgPrice) : null;
          const cumExecFee = parseFloat(order.cumExecFee || '0');

          // Validate parsed numeric values
          if (isNaN(quantity) || quantity <= 0) {
            console.warn('⚠️ Invalid quantity for order:', order.orderId, quantity);
            errorCount++;
            continue;
          }

          if (isNaN(price) || price <= 0) {
            console.warn('⚠️ Invalid price for order:', order.orderId, price);
            errorCount++;
            continue;
          }

          // Calculate profit/loss for filled orders
          let profitLoss = 0;
          if (order.orderStatus === 'Filled' && avgPrice && !isNaN(avgPrice)) {
            // For filled orders, store the fee as negative P&L for now
            // This will be updated by the P&L calculation system later
            profitLoss = -Math.abs(cumExecFee);
          }

          // Map Bybit order status to our system status
          let mappedStatus = 'pending';
          switch (order.orderStatus?.toLowerCase()) {
            case 'filled':
              mappedStatus = 'filled';
              break;
            case 'partiallyfilled':
              mappedStatus = 'partial_filled';
              break;
            case 'cancelled':
              mappedStatus = 'cancelled';
              break;
            default:
              mappedStatus = 'pending';
          }

          // Prepare trade data for insertion
          const tradeData = {
            user_id: user.id,
            symbol: order.symbol,
            side: order.side.toLowerCase(),
            quantity: quantity,
            price: price,
            status: mappedStatus,
            order_type: (order.orderType || 'market').toLowerCase(),
            bybit_order_id: order.orderId,
            buy_fill_price: avgPrice,
            profit_loss: profitLoss,
            created_at: order.createdTime ? new Date(parseInt(order.createdTime)).toISOString() : new Date().toISOString(),
            updated_at: order.updatedTime ? new Date(parseInt(order.updatedTime)).toISOString() : new Date().toISOString(),
          };

          console.log('💾 Inserting trade:', { ...tradeData, user_id: '[HIDDEN]' });

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

      // Log sync results
      await supabase
        .from('trading_logs')
        .insert({
          user_id: user.id,
          log_type: 'data_sync',
          message: `Bybit sync completed: ${syncedCount} new, ${skippedCount} skipped, ${errorCount} errors`,
          data: {
            syncedCount,
            skippedCount,
            errorCount,
            totalProcessed: orders.length
          },
        });

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
