
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Key, Save } from 'lucide-react';

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
    is_active: false,
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
      const { data, error } = await (supabase as any)
        .from('api_credentials')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange_name', 'bybit')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setCredentials(data);
        setHasExisting(true);
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const credentialData = {
        user_id: user.id,
        exchange_name: credentials.exchange_name,
        api_key: credentials.api_key,
        api_secret: credentials.api_secret,
        testnet: credentials.testnet,
        is_active: credentials.is_active,
        updated_at: new Date().toISOString(),
      };

      if (hasExisting) {
        const { error } = await (supabase as any)
          .from('api_credentials')
          .update(credentialData)
          .eq('user_id', user.id)
          .eq('exchange_name', 'bybit');

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('api_credentials')
          .insert(credentialData);

        if (error) throw error;
        setHasExisting(true);
      }

      toast({
        title: "Success",
        description: "API credentials saved successfully.",
      });
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast({
        title: "Error",
        description: "Failed to save API credentials.",
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
          Exchange API Credentials
        </CardTitle>
        <CardDescription>
          Configure your Bybit API credentials for automated trading. Keep testnet enabled for safe testing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api_key">API Key</Label>
          <Input
            id="api_key"
            type="password"
            value={credentials.api_key}
            onChange={(e) => setCredentials(prev => ({ ...prev, api_key: e.target.value }))}
            placeholder="Enter your Bybit API key"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="api_secret">API Secret</Label>
          <Input
            id="api_secret"
            type="password"
            value={credentials.api_secret}
            onChange={(e) => setCredentials(prev => ({ ...prev, api_secret: e.target.value }))}
            placeholder="Enter your Bybit API secret"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={credentials.testnet}
            onCheckedChange={(checked) => setCredentials(prev => ({ ...prev, testnet: checked }))}
          />
          <Label>Use Testnet (Recommended for testing)</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={credentials.is_active}
            onCheckedChange={(checked) => setCredentials(prev => ({ ...prev, is_active: checked }))}
          />
          <Label>Enable API Access</Label>
        </div>

        <Button onClick={handleSave} disabled={isLoading} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          Save Credentials
        </Button>
      </CardContent>
    </Card>
  );
};

export default ApiCredentials;
