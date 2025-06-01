
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Key, Save, CheckCircle } from 'lucide-react';

interface ApiCredential {
  id: string;
  exchange_name: string;
  api_key: string;
  api_secret: string;
  testnet: boolean;
  is_active: boolean;
}

const ApiCredentials = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<ApiCredential>({
    id: '',
    exchange_name: 'bybit',
    api_key: '',
    api_secret: '',
    testnet: true,
    is_active: true, // Default to active
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCredentials();
    }
  }, [user]);

  const fetchCredentials = async () => {
    if (!user) return;

    try {
      console.log('Fetching API credentials for user:', user.id);
      const { data, error } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange_name', 'bybit')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching credentials:', error);
        throw error;
      }

      if (data) {
        console.log('Found existing credentials:', { ...data, api_secret: '[HIDDEN]' });
        setCredentials(data);
        setHasExisting(true);
      } else {
        console.log('No existing credentials found');
        // Set default values for new credentials
        setCredentials(prev => ({
          ...prev,
          testnet: true,
          is_active: true
        }));
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!credentials.api_key || !credentials.api_secret) {
      toast({
        title: "Validation Error",
        description: "Please enter both API Key and API Secret.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const credentialData = {
        user_id: user.id,
        exchange_name: 'bybit',
        api_key: credentials.api_key,
        api_secret: credentials.api_secret,
        testnet: credentials.testnet,
        is_active: credentials.is_active,
        updated_at: new Date().toISOString(),
      };

      console.log('Saving credentials:', { ...credentialData, api_secret: '[HIDDEN]' });

      if (hasExisting) {
        const { error } = await supabase
          .from('api_credentials')
          .update(credentialData)
          .eq('user_id', user.id)
          .eq('exchange_name', 'bybit');

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        console.log('Credentials updated successfully');
      } else {
        const { data, error } = await supabase
          .from('api_credentials')
          .insert(credentialData)
          .select()
          .single();

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        
        console.log('Credentials inserted successfully:', data?.id);
        setCredentials(prev => ({ ...prev, id: data.id }));
        setHasExisting(true);
      }

      toast({
        title: "Success",
        description: "Bybit testnet API credentials saved successfully.",
      });

      // Force a re-fetch to confirm the save
      await fetchCredentials();
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast({
        title: "Error",
        description: "Failed to save API credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    if (!credentials.api_key || !credentials.api_secret) {
      toast({
        title: "Missing Credentials",
        description: "Please enter your API credentials first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('Testing Bybit testnet API connection...');
      
      const { data: apiResponse, error: apiError } = await supabase.functions.invoke('bybit-api', {
        body: {
          endpoint: '/v5/market/tickers',
          method: 'GET',
          params: {
            category: 'spot',
            symbol: 'BTCUSDT'
          },
          isDemoTrading: true
        }
      });

      if (apiError) {
        console.error('API Error:', apiError);
        toast({
          title: "Connection Failed",
          description: `API Error: ${apiError.message}`,
          variant: "destructive",
        });
        return;
      }

      if (apiResponse?.retCode === 0) {
        const price = apiResponse.result?.list?.[0]?.lastPrice;
        toast({
          title: "Connection Successful",
          description: `Successfully connected to Bybit testnet! BTC price: $${price}`,
        });
        console.log('Bybit testnet API connection successful:', apiResponse);
      } else {
        toast({
          title: "Connection Test Warning",
          description: `API returned: ${apiResponse?.retMsg || 'Unknown response'}`,
          variant: "destructive",
        });
        console.log('API response:', apiResponse);
      }
    } catch (error) {
      console.error('Connection test error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to test API connection. Please check your credentials.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Bybit Testnet API Credentials
          {hasExisting && credentials.is_active && (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
        </CardTitle>
        <CardDescription>
          Configure your Bybit testnet API credentials for automated trading. Always use testnet for safe testing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api_key">Testnet API Key</Label>
          <Input
            id="api_key"
            type="text"
            value={credentials.api_key}
            onChange={(e) => setCredentials(prev => ({ ...prev, api_key: e.target.value }))}
            placeholder="Enter your Bybit testnet API key"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="api_secret">Testnet API Secret</Label>
          <Input
            id="api_secret"
            type="password"
            value={credentials.api_secret}
            onChange={(e) => setCredentials(prev => ({ ...prev, api_secret: e.target.value }))}
            placeholder="Enter your Bybit testnet API secret"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={credentials.testnet}
            onCheckedChange={(checked) => setCredentials(prev => ({ ...prev, testnet: checked }))}
          />
          <Label>Use Testnet (Recommended - Always keep enabled)</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={credentials.is_active}
            onCheckedChange={(checked) => setCredentials(prev => ({ ...prev, is_active: checked }))}
          />
          <Label>Enable API Access</Label>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isLoading} className="flex-1">
            <Save className="mr-2 h-4 w-4" />
            Save Credentials
          </Button>
          <Button 
            onClick={testConnection} 
            variant="outline"
            disabled={!credentials.api_key || !credentials.api_secret || isLoading}
          >
            Test Connection
          </Button>
        </div>

        {hasExisting && (
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">
            ✅ Bybit testnet API credentials are configured and {credentials.is_active ? 'ACTIVE' : 'INACTIVE'}
            <br />
            <small>Using Bybit Testnet environment for safe trading</small>
          </div>
        )}

        <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
          💡 <strong>Get Testnet Credentials:</strong> Visit{' '}
          <a 
            href="https://testnet.bybit.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline font-semibold"
          >
            testnet.bybit.com
          </a>
          {' '}→ Create account → API Management → Create API Key with trading permissions
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiCredentials;
