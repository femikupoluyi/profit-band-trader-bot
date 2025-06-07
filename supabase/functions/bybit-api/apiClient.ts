
import { BybitRequest } from './types.ts';
import { buildGetRequest, buildPostRequest } from './requestBuilder.ts';

export const makeBybitRequest = async (
  request: BybitRequest,
  apiKey: string,
  apiSecret: string
): Promise<any> => {
  const { method = 'GET', isDemoTrading = true } = request; // Default to demo trading
  
  // Use correct URL: demo trading (not testnet) for live demo trading
  const baseUrl = isDemoTrading ? 'https://api-demo.bybit.com' : 'https://api.bybit.com';
  
  console.log(`Using Bybit ${isDemoTrading ? 'DEMO TRADING' : 'LIVE'} exchange URL: ${baseUrl}`);

  let response: Response;

  if (method === 'GET') {
    const { url, headers } = await buildGetRequest(request, apiKey, apiSecret, baseUrl);
    
    console.log(`Making ${method} request to Bybit ${isDemoTrading ? 'DEMO TRADING' : 'LIVE'} exchange: ${url}`);
    console.log(`Request headers for ${isDemoTrading ? 'DEMO TRADING' : 'LIVE'} exchange:`, { ...headers, 'X-BAPI-API-KEY': apiKey.substring(0, 8) + '...' });

    response = await fetch(url, {
      method,
      headers,
      cache: 'no-store'
    });
  } else {
    const { url, headers, body } = await buildPostRequest(request, apiKey, apiSecret, baseUrl);
    
    console.log(`Making ${method} request to Bybit ${isDemoTrading ? 'DEMO TRADING' : 'LIVE'} exchange: ${url}`);
    console.log('Request body:', body);
    console.log(`Request headers for ${isDemoTrading ? 'DEMO TRADING' : 'LIVE'} exchange:`, { ...headers, 'X-BAPI-API-KEY': apiKey.substring(0, 8) + '...' });

    response = await fetch(url, {
      method,
      headers,
      body,
      cache: 'no-store'
    });
  }

  const responseData = await response.json();
  console.log(`Bybit ${isDemoTrading ? 'DEMO TRADING' : 'LIVE'} exchange response:`, responseData);

  return { responseData, status: response.status };
};
