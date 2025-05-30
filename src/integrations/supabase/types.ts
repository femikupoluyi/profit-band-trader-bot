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
      banks: {
        Row: {
          code: string
          country: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          code: string
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      bulk_uploads: {
        Row: {
          created_at: string | null
          error_details: Json | null
          failed_records: number | null
          file_name: string
          id: string
          status: string | null
          successful_records: number | null
          total_records: number | null
          upload_type: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          error_details?: Json | null
          failed_records?: number | null
          file_name: string
          id?: string
          status?: string | null
          successful_records?: number | null
          total_records?: number | null
          upload_type: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          error_details?: Json | null
          failed_records?: number | null
          file_name?: string
          id?: string
          status?: string | null
          successful_records?: number | null
          total_records?: number | null
          upload_type?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          company: string
          country: string | null
          created_at: string | null
          email: string
          id: string
          industry: string | null
          name: string
          phone: string | null
          profile_id: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company: string
          country?: string | null
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          name: string
          phone?: string | null
          profile_id?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company?: string
          country?: string | null
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          name?: string
          phone?: string | null
          profile_id?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_id: string | null
          contract_number: string
          created_at: string | null
          document_url: string | null
          end_date: string
          id: string
          insurer_id: string | null
          payment_frequency: string | null
          policy_number: string | null
          premium_amount: number
          quote_request_id: string | null
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          contract_number: string
          created_at?: string | null
          document_url?: string | null
          end_date: string
          id?: string
          insurer_id?: string | null
          payment_frequency?: string | null
          policy_number?: string | null
          premium_amount: number
          quote_request_id?: string | null
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          contract_number?: string
          created_at?: string | null
          document_url?: string | null
          end_date?: string
          id?: string
          insurer_id?: string | null
          payment_frequency?: string | null
          policy_number?: string | null
          premium_amount?: number
          quote_request_id?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string | null
          email_type: string
          entity_id: string | null
          entity_type: string | null
          id: string
          sent_at: string | null
          status: string | null
          subject: string
          to_email: string
        }
        Insert: {
          created_at?: string | null
          email_type: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          subject: string
          to_email: string
        }
        Update: {
          created_at?: string | null
          email_type?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          subject?: string
          to_email?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string | null
          html_content: string
          id: string
          is_active: boolean | null
          subject: string
          template_type: string
        }
        Insert: {
          created_at?: string | null
          html_content: string
          id?: string
          is_active?: boolean | null
          subject: string
          template_type: string
        }
        Update: {
          created_at?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          subject?: string
          template_type?: string
        }
        Relationships: []
      }
      insurable_items: {
        Row: {
          created_at: string | null
          id: string
          is_selected: boolean | null
          item_name: string
          quote_request_id: string | null
          risk_level: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_selected?: boolean | null
          item_name: string
          quote_request_id?: string | null
          risk_level?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_selected?: boolean | null
          item_name?: string
          quote_request_id?: string | null
          risk_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurable_items_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      insurers: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          license_number: string | null
          name: string
          rating: number | null
          specialties: string[] | null
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          name: string
          rating?: number | null
          specialties?: string[] | null
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          name?: string
          rating?: number | null
          specialties?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_id: string | null
          client_id: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
        }
        Insert: {
          account_name: string
          account_number: string
          bank_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_accounts_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contract_id: string | null
          created_at: string | null
          due_date: string | null
          gateway_response: Json | null
          id: string
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          contract_id?: string | null
          created_at?: string | null
          due_date?: string | null
          gateway_response?: Json | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          contract_id?: string | null
          created_at?: string | null
          due_date?: string | null
          gateway_response?: Json | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quote_drafts: {
        Row: {
          client_info: Json
          created_at: string
          id: string
          identified_items: Json
          request_details: Json
          updated_at: string
        }
        Insert: {
          client_info: Json
          created_at?: string
          id?: string
          identified_items: Json
          request_details: Json
          updated_at?: string
        }
        Update: {
          client_info?: Json
          created_at?: string
          id?: string
          identified_items?: Json
          request_details?: Json
          updated_at?: string
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          assets_details: string | null
          client_id: string | null
          coverage_amount: number | null
          created_at: string | null
          description: string
          id: string
          policy_type: string
          priority: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assets_details?: string | null
          client_id?: string | null
          coverage_amount?: number | null
          created_at?: string | null
          description: string
          id?: string
          policy_type: string
          priority?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assets_details?: string | null
          client_id?: string | null
          coverage_amount?: number | null
          created_at?: string | null
          description?: string
          id?: string
          policy_type?: string
          priority?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_submissions: {
        Row: {
          attachments: Json | null
          coverage_details: Json | null
          created_at: string | null
          id: string
          insurer_id: string | null
          notes: string | null
          premium_amount: number
          quote_request_id: string | null
          rfq_id: string | null
          status: string | null
          submission_date: string | null
          submission_method: string | null
          submitted_by_email: string | null
          terms_conditions: string | null
          updated_at: string | null
          validity_period: number | null
        }
        Insert: {
          attachments?: Json | null
          coverage_details?: Json | null
          created_at?: string | null
          id?: string
          insurer_id?: string | null
          notes?: string | null
          premium_amount: number
          quote_request_id?: string | null
          rfq_id?: string | null
          status?: string | null
          submission_date?: string | null
          submission_method?: string | null
          submitted_by_email?: string | null
          terms_conditions?: string | null
          updated_at?: string | null
          validity_period?: number | null
        }
        Update: {
          attachments?: Json | null
          coverage_details?: Json | null
          created_at?: string | null
          id?: string
          insurer_id?: string | null
          notes?: string | null
          premium_amount?: number
          quote_request_id?: string | null
          rfq_id?: string | null
          status?: string | null
          submission_date?: string | null
          submission_method?: string | null
          submitted_by_email?: string | null
          terms_conditions?: string | null
          updated_at?: string | null
          validity_period?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_submissions_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_submissions_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_submissions_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_assignments: {
        Row: {
          assigned_at: string | null
          id: string
          insurer_id: string | null
          notes: string | null
          quote_request_id: string | null
          response_deadline: string | null
          status: string | null
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          insurer_id?: string | null
          notes?: string | null
          quote_request_id?: string | null
          response_deadline?: string | null
          status?: string | null
        }
        Update: {
          assigned_at?: string | null
          id?: string
          insurer_id?: string | null
          notes?: string | null
          quote_request_id?: string | null
          response_deadline?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_assignments_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_assignments_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_recipients: {
        Row: {
          created_at: string | null
          id: string
          insurer_id: string | null
          rfq_id: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          insurer_id?: string | null
          rfq_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          insurer_id?: string | null
          rfq_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_recipients_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_recipients_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          default_deadline_days: number | null
          description: string
          id: string
          is_active: boolean | null
          name: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          default_deadline_days?: number | null
          description: string
          id?: string
          is_active?: boolean | null
          name: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          default_deadline_days?: number | null
          description?: string
          id?: string
          is_active?: boolean | null
          name?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rfqs: {
        Row: {
          created_at: string | null
          description: string
          id: string
          quote_request_id: string | null
          rfq_number: string
          status: string | null
          submission_deadline: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          quote_request_id?: string | null
          rfq_number: string
          status?: string | null
          submission_deadline: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          quote_request_id?: string | null
          rfq_number?: string
          status?: string | null
          submission_deadline?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
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
