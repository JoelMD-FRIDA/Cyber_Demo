export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          username: string | null;
          firstname: string | null;
          lastname: string | null;
          company: string | null;
          role: 'admin' | 'user';
          performed_domain_checks: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string; email: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [];
      };
      registration_keys: {
        Row: {
          id: string;
          code: string;
          company_domain: string | null;
          total_slots: number;
          company: string | null;
          used_count: number;
          enabled: boolean;
          expires_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['registration_keys']['Row']> & { code: string; total_slots: number };
        Update: Partial<Database['public']['Tables']['registration_keys']['Row']>;
        Relationships: [];
      };
      domain_check_providers: {
        Row: {
          id: string;
          provider_key: string;
          name: string;
          is_active: boolean;
          website_url: string | null;
          description: string | null;
          short_description: string | null;
          long_description: string | null;
          asset_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['domain_check_providers']['Row']> & { provider_key: string; name: string };
        Update: Partial<Database['public']['Tables']['domain_check_providers']['Row']>;
        Relationships: [];
      };
      domain_check_categories: {
        Row: {
          id: string;
          category_key: string;
          name: string;
          description: string | null;
          asset_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['domain_check_categories']['Row']> & { category_key: string; name: string };
        Update: Partial<Database['public']['Tables']['domain_check_categories']['Row']>;
        Relationships: [];
      };
      domain_checks: {
        Row: {
          id: string;
          user_id: string;
          provider_id: string;
          category_id: string;
          url: string;
          status: 'queued' | 'running' | 'completed' | 'partial' | 'failed';
          raw_result: Json | null;
          structured_result: Json | null;
          external_job_id: string | null;
          external_report_id: string | null;
          attempt_count: number;
          next_poll_at: string | null;
          lease_until: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          has_accepted_disclaimer: boolean;
          disclaimer_accepted_at: string | null;
          disclaimer_version: string | null;
          remaining_domain_checks: number;
          max_checks: number;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['domain_checks']['Row']> & { user_id: string; provider_id: string; category_id: string; url: string };
        Update: Partial<Database['public']['Tables']['domain_checks']['Row']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      reserve_registration_key: { Args: { p_code: string }; Returns: Json };
      create_queued_domain_check: {
        Args: {
          p_user_id: string;
          p_provider_id: string;
          p_category_id: string;
          p_url: string;
          p_has_accepted_disclaimer: boolean;
          p_disclaimer_version: string;
          p_limit: number;
        };
        Returns: Database['public']['Tables']['domain_checks']['Row'][];
      };
      claim_domain_checks: { Args: { p_limit: number; p_lease_seconds?: number }; Returns: Database['public']['Tables']['domain_checks']['Row'][] };
    };
    Enums: {
      user_role: 'admin' | 'user';
      domain_check_status: 'queued' | 'running' | 'completed' | 'partial' | 'failed';
    };
    CompositeTypes: Record<string, never>;
  };
};
