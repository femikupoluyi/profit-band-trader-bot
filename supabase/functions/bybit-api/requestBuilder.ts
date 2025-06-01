
import { BybitRequest } from './types.ts';
import { generateGetSignature, generatePostSignature } from './signature.ts';

export const buildGetRequest = async (
  request: BybitRequest,
  apiKey: string,
  apiSecret: string,
  baseUrl: string
): Promise<{ url: string; headers: Record<string, string> }> => {
  const { endpoint, params = {} } = request;
  const timestamp = Date.now().toString();
  const recvWindow = '5000';

  const signature = await generateGetSignature({
    apiKey,
    apiSecret,
    timestamp,
    recvWindow,
    params
  });

  // Build final URL with signature
  const queryParams = new URLSearchParams({
    api_key: apiKey,
    timestamp: timestamp,
    recv_window: recvWindow,
  });

  // Add endpoint-specific params
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && 
        !key.startsWith('_') && key !== 'cacheBust') {
      queryParams.append(key, params[key].toString());
    }
  });

  // Sort parameters alphabetically for consistent URL
  const sortedParams = new URLSearchParams();
  const sortedKeys = Array.from(queryParams.keys()).sort();
  
  for (const key of sortedKeys) {
    sortedParams.append(key, queryParams.get(key)!);
  }
  
  sortedParams.append('sign', signature);
  const finalUrl = `${baseUrl}${endpoint}?${sortedParams.toString()}`;

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  return { url: finalUrl, headers };
};

export const buildPostRequest = async (
  request: BybitRequest,
  apiKey: string,
  apiSecret: string,
  baseUrl: string
): Promise<{ url: string; headers: Record<string, string>; body: string }> => {
  const { endpoint, params = {} } = request;
  const timestamp = Date.now().toString();
  const recvWindow = '5000';

  // Clean params for POST body
  const cleanParams = { ...params };
  delete cleanParams._t;
  delete cleanParams._cache_bust;
  delete cleanParams._nocache;
  delete cleanParams._fresh;
  delete cleanParams._live;
  delete cleanParams.cacheBust;

  const requestBody = JSON.stringify(cleanParams);
  
  const signature = await generatePostSignature({
    apiKey,
    apiSecret,
    timestamp,
    recvWindow,
    params,
    requestBody
  });

  const headers = {
    'Content-Type': 'application/json',
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': recvWindow,
    'X-BAPI-SIGN': signature,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  return { 
    url: `${baseUrl}${endpoint}`, 
    headers, 
    body: requestBody 
  };
};
