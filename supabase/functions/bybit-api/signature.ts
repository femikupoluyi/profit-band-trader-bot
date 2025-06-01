
import { SignatureParams } from './types.ts';

export const generateGetSignature = async (params: SignatureParams): Promise<string> => {
  const { apiKey, apiSecret, timestamp, recvWindow, params: requestParams } = params;
  
  // Build query parameters with consistent ordering
  const queryParams: Record<string, string> = {
    api_key: apiKey,
    timestamp: timestamp,
    recv_window: recvWindow,
  };
  
  // Add endpoint-specific params (excluding cache busting params from signature)
  Object.keys(requestParams).forEach(key => {
    if (requestParams[key] !== undefined && requestParams[key] !== null && 
        !key.startsWith('_') && key !== 'cacheBust') {
      queryParams[key] = requestParams[key].toString();
    }
  });

  // Sort parameters alphabetically for consistent signature generation
  const sortedKeys = Object.keys(queryParams).sort();
  const sortedParams = new URLSearchParams();
  
  for (const key of sortedKeys) {
    sortedParams.append(key, queryParams[key]);
  }
  
  // Create signature using sorted query string
  const queryString = sortedParams.toString();
  console.log(`GET query string for signature: ${queryString}`);
  
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

  console.log(`Generated GET signature: ${signature}`);
  return signature;
};

export const generatePostSignature = async (params: SignatureParams): Promise<string> => {
  const { apiKey, apiSecret, timestamp, recvWindow, requestBody } = params;
  
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
  
  console.log('POST signature for headers:', signature);
  return signature;
};
