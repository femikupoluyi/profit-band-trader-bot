

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
  timestamp?: number;
  cacheBust?: string;
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

    const { endpoint, method = 'GET', params = {}, isDemoTrading = false }: BybitRequest = await req.json();

    // Get API credentials from secrets - now using MAIN exchange credentials
    const apiKey = Deno.env.get('BYBIT_API_KEY');
    const apiSecret = Deno.env.get('BYBIT_API_SECRET');

    if (!apiKey || !apiSecret) {
      console.error('Missing Bybit MAIN API credentials:', { apiKey: !!apiKey, apiSecret: !!apiSecret });
      return new Response(
        JSON.stringify({ error: 'Bybit MAIN API credentials not configured. Please add BYBIT_API_KEY and BYBIT_API_SECRET to Supabase secrets.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Using Bybit MAIN exchange credentials for API call');

    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    
    // Always use MAIN exchange environment
    const baseUrl = 'https://api.bybit.com';
    
    let finalUrl: string;
    let requestBody: string | undefined;

    if (method === 'GET') {
      // For GET requests, create query string with proper signature
      const queryParams = new URLSearchParams();
      queryParams.append('api_key', apiKey);
      queryParams.append('timestamp', timestamp);
      queryParams.append('recv_window', recvWindow);
      
      // Add all other params (excluding cache busting params from signature)
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && 
            !key.startsWith('_') && key !== 'cacheBust') {
          queryParams.append(key, params[key].toString());
        }
      });

      // Sort parameters for signature
      queryParams.sort();
      
      // Create signature - sign the query string only
      const queryString = queryParams.toString();
      console.log('GET query string for signature:', queryString);
      
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

      console.log('Generated GET signature for MAIN exchange:', signature);
      queryParams.append('sign', signature);
      finalUrl = `${baseUrl}${endpoint}?${queryParams.toString()}`;
      
    } else {
      // For POST requests, use V5 signature method
      const cleanParams = { ...params };
      // Remove cache busting parameters from the actual request
      delete cleanParams._t;
      delete cleanParams._cache_bust;
      delete cleanParams._nocache;
      delete cleanParams._fresh;
      delete cleanParams._live;
      delete cleanParams.cacheBust;
      
      // For V5 API, send clean params as JSON body
      requestBody = JSON.stringify(cleanParams);
      finalUrl = `${baseUrl}${endpoint}`;
    }

    console.log(`Making ${method} request to Bybit MAIN exchange:`, finalUrl);
    if (requestBody) {
      console.log('Request body:', requestBody);
    }

    // Prepare headers for MAIN exchange
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': recvWindow,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    // Add signature to headers for POST requests (V5 API)
    if (method === 'POST') {
      const postSignString = timestamp + apiKey + recvWindow + (requestBody || '');
      console.log('POST signature string:', postSignString);
      
      const encoder = new TextEncoder();
      const keyData = encoder.encode(apiSecret);
      const dataToSign = encoder.encode(postSignString);
      
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
      
      headers['X-BAPI-SIGN'] = signature;
      console.log('POST signature for headers:', signature);
    }

    console.log('Request headers for MAIN exchange:', headers);

    const response = await fetch(finalUrl, {
      method,
      headers,
      body: requestBody,
      cache: 'no-store'  // Ensure no caching
    });

    const responseData = await response.json();
    console.log('Bybit MAIN exchange response:', responseData);

    return new Response(
      JSON.stringify(responseData),
      { 
        status: response.status,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

  } catch (error) {
    console.error('Bybit MAIN exchange API error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
