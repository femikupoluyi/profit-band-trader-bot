
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

    // Get API credentials from secrets
    const apiKey = Deno.env.get('BYBIT_API_KEY');
    const apiSecret = Deno.env.get('BYBIT_API_SECRET');

    if (!apiKey || !apiSecret) {
      console.error('Missing Bybit API credentials:', { apiKey: !!apiKey, apiSecret: !!apiSecret });
      return createCorsResponse(
        { error: 'Bybit API credentials not configured. Please add BYBIT_API_KEY and BYBIT_API_SECRET to Supabase secrets.' },
        400
      );
    }

    const { responseData, status } = await makeBybitRequest(request, apiKey, apiSecret);

    return createCorsResponse(responseData, status);

  } catch (error) {
    console.error('Bybit API error:', error);
    return createCorsResponse({ error: error.message }, 500);
  }
});
