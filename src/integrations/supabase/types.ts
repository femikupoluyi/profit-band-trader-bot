export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      api_credentials: {
        Row: {
          api_key: string
          api_secret: string
          created_at: string | null
          exchange_name: string
          id: string
          is_active: boolean | null
          testnet: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key: string
          api_secret: string
          created_at?: string | null
          exchange_name: string
          id?: string
          is_active?: boolean | null
          testnet?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key?: string
          api_secret?: string
          created_at?: string | null
          exchange_name?: string
          id?: string
          is_active?: boolean | null
          testnet?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      market_data: {
        Row: {
          id: string
          price: number
          source: string | null
          symbol: string
          timestamp: string | null
          volume: number | null
        }
        Insert: {
          id?: string
          price: number
          source?: string | null
          symbol: string
          timestamp?: string | null
          volume?: number | null
        }
        Update: {
          id?: string
          price?: number
          source?: string | null
          symbol?: string
          timestamp?: string | null
          volume?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      trades: {
        Row: {
          buy_fill_price: number | null
          bybit_order_id: string | null
          created_at: string | null
          id: string
          order_type: string
          price: number
          profit_loss: number | null
          quantity: number
          side: string
          status: string
          symbol: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          buy_fill_price?: number | null
          bybit_order_id?: string | null
          created_at?: string | null
          id?: string
          order_type?: string
          price: number
          profit_loss?: number | null
          quantity: number
          side: string
          status?: string
          symbol: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          buy_fill_price?: number | null
          bybit_order_id?: string | null
          created_at?: string | null
          id?: string
          order_type?: string
          price?: number
          profit_loss?: number | null
          quantity?: number
          side?: string
          status?: string
          symbol?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trading_configs: {
        Row: {
          auto_close_at_end_of_day: boolean | null
          chart_timeframe: string | null
          created_at: string | null
          daily_reset_time: string | null
          entry_offset_percent: number | null
          eod_close_premium_percent: number | null
          id: string
          is_active: boolean | null
          main_loop_interval_seconds: number | null
          manual_close_premium_percent: number | null
          max_active_pairs: number | null
          max_drawdown_percent: number | null
          max_order_amount_usd: number | null
          max_portfolio_exposure_percent: number | null
          max_positions_per_pair: number | null
          minimum_notional_per_symbol: Json | null
          new_support_threshold_percent: number | null
          notes: string | null
          price_decimals_per_symbol: Json | null
          quantity_decimals_per_symbol: Json | null
          quantity_increment_per_symbol: Json | null
          support_candle_count: number | null
          support_lower_bound_percent: number | null
          support_upper_bound_percent: number | null
          take_profit_percent: number | null
          trading_pairs: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_close_at_end_of_day?: boolean | null
          chart_timeframe?: string | null
          created_at?: string | null
          daily_reset_time?: string | null
          entry_offset_percent?: number | null
          eod_close_premium_percent?: number | null
          id?: string
          is_active?: boolean | null
          main_loop_interval_seconds?: number | null
          manual_close_premium_percent?: number | null
          max_active_pairs?: number | null
          max_drawdown_percent?: number | null
          max_order_amount_usd?: number | null
          max_portfolio_exposure_percent?: number | null
          max_positions_per_pair?: number | null
          minimum_notional_per_symbol?: Json | null
          new_support_threshold_percent?: number | null
          notes?: string | null
          price_decimals_per_symbol?: Json | null
          quantity_decimals_per_symbol?: Json | null
          quantity_increment_per_symbol?: Json | null
          support_candle_count?: number | null
          support_lower_bound_percent?: number | null
          support_upper_bound_percent?: number | null
          take_profit_percent?: number | null
          trading_pairs?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_close_at_end_of_day?: boolean | null
          chart_timeframe?: string | null
          created_at?: string | null
          daily_reset_time?: string | null
          entry_offset_percent?: number | null
          eod_close_premium_percent?: number | null
          id?: string
          is_active?: boolean | null
          main_loop_interval_seconds?: number | null
          manual_close_premium_percent?: number | null
          max_active_pairs?: number | null
          max_drawdown_percent?: number | null
          max_order_amount_usd?: number | null
          max_portfolio_exposure_percent?: number | null
          max_positions_per_pair?: number | null
          minimum_notional_per_symbol?: Json | null
          new_support_threshold_percent?: number | null
          notes?: string | null
          price_decimals_per_symbol?: Json | null
          quantity_decimals_per_symbol?: Json | null
          quantity_increment_per_symbol?: Json | null
          support_candle_count?: number | null
          support_lower_bound_percent?: number | null
          support_upper_bound_percent?: number | null
          take_profit_percent?: number | null
          trading_pairs?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trading_logs: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          log_type: string
          message: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          log_type: string
          message: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          log_type?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      trading_signals: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          price: number
          processed: boolean | null
          reasoning: string | null
          signal_type: string
          symbol: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          price: number
          processed?: boolean | null
          reasoning?: string | null
          signal_type: string
          symbol: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          price?: number
          processed?: boolean | null
          reasoning?: string | null
          signal_type?: string
          symbol?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
