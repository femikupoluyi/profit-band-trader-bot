
export interface ApiCredential {
  id: string;
  user_id: string;
  exchange_name: string;
  api_key: string;
  api_secret: string;
  api_url: string;
  testnet: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
