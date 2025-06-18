
import { supabase } from '@/integrations/supabase/client';

export class DatabaseConnection {
  static async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      return !error;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  static getClient() {
    return supabase;
  }
}
