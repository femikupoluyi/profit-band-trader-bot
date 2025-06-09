
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BybitRequest } from './types.ts'
import { corsHeaders, createCorsResponse, handleCorsPrelight } from './cors.ts'
import { makeBybitRequest } from './apiClient.ts'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsPrelight();
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const request: BybitRequest = await req.json();
    console.log('Received Bybit API request:', { 
      endpoint: request.endpoint, 
      method: request.method,
      isDemoTrading: request.isDemoTrading 
    });

    // Get API credentials - first try from Supabase secrets, then from user credentials
    let apiKey = Deno.env.get('BYBIT_API_KEY');
    let apiSecret = Deno.env.get('BYBIT_API_SECRET');

    if (!apiKey || !apiSecret) {
      console.log('No Supabase secrets found, using user credentials from request');
      
      // For now, we'll need to pass credentials in the request
      // This is less secure but functional for demo trading
      if (request.apiKey && request.apiSecret) {
        apiKey = request.apiKey;
        apiSecret = request.apiSecret;
      } else {
        console.error('No API credentials available');
        return createCorsResponse(
          { error: 'API credentials not available. Please configure your Bybit API credentials.' },
          400
        );
      }
    }

    console.log('Using API credentials:', { 
      hasApiKey: !!apiKey, 
      hasApiSecret: !!apiSecret,
      source: Deno.env.get('BYBIT_API_KEY') ? 'supabase_secrets' : 'user_request'
    });

    const { responseData, status } = await makeBybitRequest(request, apiKey, apiSecret);

    console.log('Bybit API response:', { status, retCode: responseData?.retCode });
    
    return createCorsResponse(responseData, status);

  } catch (error) {
    console.error('Bybit API error:', error);
    return createCorsResponse({ error: error.message }, 500);
  }
});
