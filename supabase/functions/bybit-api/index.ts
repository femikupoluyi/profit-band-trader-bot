
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
  isDemoTrading?: boolean;
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

    const { endpoint, method = 'GET', params = {}, isDemoTrading = true }: BybitRequest = await req.json();

    // Get API credentials from secrets
    const apiKey = Deno.env.get('BYBIT_DEMO_API_KEY');
    const apiSecret = Deno.env.get('BYBIT_DEMO_API_SECRET');

    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: 'Bybit API credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    
    // Use demo environment for all requests
    const baseUrl = 'https://api-demo.bybit.com';
    
    let finalUrl: string;
    let requestBody: string | undefined;

    if (method === 'GET') {
      // For GET requests, create query string with proper signature
      const queryParams = new URLSearchParams();
      queryParams.append('api_key', apiKey);
      queryParams.append('timestamp', timestamp);
      queryParams.append('recv_window', recvWindow);
      
      // Add all other params
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          queryParams.append(key, params[key].toString());
        }
      });

      // Sort parameters for signature
      queryParams.sort();
      
      // Create signature payload
      const signaturePayload = queryParams.toString() + apiSecret;
      console.log('GET signature payload:', signaturePayload);
      
      // Generate HMAC SHA256 signature
      const encoder = new TextEncoder();
      const keyData = encoder.encode(apiSecret);
      const dataToSign = encoder.encode(queryParams.toString());
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign);
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      queryParams.append('sign', signature);
      finalUrl = `${baseUrl}${endpoint}?${queryParams.toString()}`;
      
    } else {
      // For POST requests, create JSON body with signature
      const requestParams = {
        ...params,
        api_key: apiKey,
        timestamp,
        recv_window: recvWindow,
      };

      // Create sorted query string for signature
      const sortedKeys = Object.keys(requestParams).sort();
      const queryString = sortedKeys
        .map(key => `${key}=${requestParams[key]}`)
        .join('&');
      
      console.log('POST query string for signature:', queryString);
      
      // Generate HMAC SHA256 signature
      const encoder = new TextEncoder();
      const keyData = encoder.encode(apiSecret);
      const dataToSign = encoder.encode(queryString);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign);
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      requestParams.sign = signature;
      requestBody = JSON.stringify(requestParams);
      finalUrl = `${baseUrl}${endpoint}`;
    }

    console.log(`Making ${method} request to Bybit Demo:`, finalUrl);
    if (requestBody) {
      console.log('Request body:', requestBody);
    }

    const response = await fetch(finalUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
      },
      body: requestBody,
    });

    const responseData = await response.json();
    console.log('Bybit Demo response:', responseData);

    return new Response(
      JSON.stringify(responseData),
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
