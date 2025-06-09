
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BybitRequest } from './types.ts'
import { corsHeaders, createCorsResponse, handleCorsPrelight } from './cors.ts'
import { makeBybitRequest } from './apiClient.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPrelight();
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let request: BybitRequest;
    
    try {
      request = await req.json();
    } catch (parseError) {
      console.error('❌ Failed to parse request JSON:', parseError);
      return createCorsResponse(
        { error: 'Invalid JSON in request body' },
        400
      );
    }

    // Validate required fields in request
    if (!request.endpoint) {
      console.error('❌ Missing required field: endpoint');
      return createCorsResponse(
        { error: 'Missing required field: endpoint' },
        400
      );
    }

    if (!request.method) {
      console.error('❌ Missing required field: method');
      return createCorsResponse(
        { error: 'Missing required field: method' },
        400
      );
    }

    console.log('📥 Received Bybit API request:', { 
      endpoint: request.endpoint, 
      method: request.method,
      isDemoTrading: request.isDemoTrading,
      hasApiUrl: !!request.apiUrl,
      hasApiKey: !!request.apiKey,
      hasApiSecret: !!request.apiSecret
    });

    let apiKey = Deno.env.get('BYBIT_API_KEY');
    let apiSecret = Deno.env.get('BYBIT_API_SECRET');

    // Check if we should use user-provided credentials
    if (!apiKey || !apiSecret) {
      console.log('ℹ️ No Supabase secrets found, checking user credentials from request');
      
      if (request.apiKey && request.apiSecret) {
        apiKey = request.apiKey;
        apiSecret = request.apiSecret;
        console.log('✅ Using user-provided credentials');
      } else {
        console.error('❌ No API credentials available');
        return createCorsResponse(
          { error: 'API credentials not available. Please configure your Bybit API credentials.' },
          401
        );
      }
    } else {
      console.log('✅ Using Supabase environment credentials');
    }

    // Validate credentials format
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      console.error('❌ Invalid API key format');
      return createCorsResponse(
        { error: 'Invalid API key format' },
        401
      );
    }

    if (!apiSecret || typeof apiSecret !== 'string' || apiSecret.trim().length === 0) {
      console.error('❌ Invalid API secret format');
      return createCorsResponse(
        { error: 'Invalid API secret format' },
        401
      );
    }

    console.log('🔑 Using API credentials:', { 
      hasApiKey: !!apiKey, 
      hasApiSecret: !!apiSecret,
      apiKeyLength: apiKey.length,
      source: Deno.env.get('BYBIT_API_KEY') ? 'supabase_secrets' : 'user_request'
    });

    try {
      const { responseData, status } = await makeBybitRequest(request, apiKey, apiSecret);

      console.log('📤 Bybit API response:', { 
        status, 
        retCode: responseData?.retCode,
        hasResult: !!responseData?.result,
        resultType: typeof responseData?.result
      });
      
      return createCorsResponse(responseData, status);
    } catch (apiError) {
      console.error('❌ Bybit API request failed:', apiError);
      return createCorsResponse(
        { 
          error: 'Bybit API request failed', 
          details: apiError instanceof Error ? apiError.message : 'Unknown error'
        }, 
        500
      );
    }

  } catch (error) {
    console.error('❌ Bybit API edge function error:', error);
    return createCorsResponse(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      500
    );
  }
});
