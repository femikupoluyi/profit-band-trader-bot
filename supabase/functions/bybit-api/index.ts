
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BybitRequest {
  endpoint: string;
  method?: string;
  params?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { endpoint, method = 'GET', params = {} }: BybitRequest = await req.json();

    // Get API credentials from secrets
    const apiKey = Deno.env.get('BYBIT_DEMO_API_KEY');
    const apiSecret = Deno.env.get('BYBIT_DEMO_API_SECRET');

    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: 'Bybit API credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create signature for authenticated requests
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    
    // Prepare parameters
    const allParams = {
      ...params,
      api_key: apiKey,
      timestamp,
      recv_window: recvWindow,
    };

    // Create query string
    const queryString = Object.keys(allParams)
      .sort()
      .map(key => `${key}=${allParams[key]}`)
      .join('&');

    // Create signature
    const signaturePayload = queryString + apiSecret;
    const encoder = new TextEncoder();
    const data = encoder.encode(signaturePayload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Add signature to params
    const finalParams = { ...allParams, sign: signature };
    const finalQueryString = Object.keys(finalParams)
      .map(key => `${key}=${finalParams[key]}`)
      .join('&');

    // Make request to Bybit
    const baseUrl = 'https://api-testnet.bybit.com';
    const url = method === 'GET' 
      ? `${baseUrl}${endpoint}?${finalQueryString}`
      : `${baseUrl}${endpoint}`;

    console.log(`Making ${method} request to Bybit:`, url);

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' ? JSON.stringify(finalParams) : undefined,
    });

    const data = await response.json();
    console.log('Bybit response:', data);

    return new Response(
      JSON.stringify(data),
      { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Bybit API error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
