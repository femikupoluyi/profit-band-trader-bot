
import { BybitRequest } from './types.ts';
import { buildGetRequest, buildPostRequest } from './requestBuilder.ts';

export const makeBybitRequest = async (
  request: BybitRequest,
  apiKey: string,
  apiSecret: string
): Promise<any> => {
  const { method = 'GET', isDemoTrading = false, apiUrl } = request;
  
  // Use provided apiUrl or fallback to default based on demo trading flag
  let baseUrl: string;
  if (apiUrl) {
    baseUrl = apiUrl;
  } else {
    baseUrl = isDemoTrading ? 'https://api-demo.bybit.com' : 'https://api.bybit.com';
  }
  
  console.log(`Using Bybit ${isDemoTrading ? 'DEMO' : 'MAIN'} exchange URL: ${baseUrl}`);

  let response: Response;

  if (method === 'GET') {
    const { url, headers } = await buildGetRequest(request, apiKey, apiSecret, baseUrl);
    
    console.log(`Making ${method} request to Bybit ${isDemoTrading ? 'DEMO' : 'MAIN'} exchange: ${url}`);
    console.log(`Request headers for ${isDemoTrading ? 'DEMO' : 'MAIN'} exchange:`, { ...headers, 'X-BAPI-API-KEY': apiKey.substring(0, 8) + '...' });

    response = await fetch(url, {
      method,
      headers,
      cache: 'no-store'
    });
  } else {
    const { url, headers, body } = await buildPostRequest(request, apiKey, apiSecret, baseUrl);
    
    console.log(`Making ${method} request to Bybit ${isDemoTrading ? 'DEMO' : 'MAIN'} exchange: ${url}`);
    console.log('Request body:', body);
    console.log(`Request headers for ${isDemoTrading ? 'DEMO' : 'MAIN'} exchange:`, { ...headers, 'X-BAPI-API-KEY': apiKey.substring(0, 8) + '...' });

    response = await fetch(url, {
      method,
      headers,
      body,
      cache: 'no-store'
    });
  }

  const responseData = await response.json();
  console.log(`Bybit ${isDemoTrading ? 'DEMO' : 'MAIN'} exchange response:`, responseData);

  return { responseData, status: response.status };
};
